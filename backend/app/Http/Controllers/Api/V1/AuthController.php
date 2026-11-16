<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\GoogleIdentityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !$user->password || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid email or password.',
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'Your account has been deactivated.',
            ], 403);
        }

        return $this->authenticatedResponse($user);
    }

    public function googleLogin(Request $request, GoogleIdentityService $googleIdentity): JsonResponse
    {
        $validated = $request->validate([
            'credential' => ['required', 'string'],
        ]);

        if (!$googleIdentity->isConfigured()) {
            return response()->json([
                'message' => 'Google sign-in is not configured on the server.',
            ], 503);
        }

        try {
            $payload = $googleIdentity->verifyIdToken($validated['credential']);
        } catch (\Throwable $exception) {
            Log::warning('Google ID token verification failed.', [
                'exception' => $exception::class,
            ]);

            $payload = null;
        }

        $googleId = trim((string) ($payload['sub'] ?? ''));
        if (!$payload || $googleId === '') {
            return response()->json([
                'message' => 'Google sign-in could not be verified. Please try again.',
            ], 401);
        }

        // Returning OAuth users are identified by Google's immutable subject ID.
        $user = User::where('google_id', $googleId)->first();

        if (!$user) {
            $email = strtolower(trim((string) ($payload['email'] ?? '')));
            $emailVerified = filter_var($payload['email_verified'] ?? false, FILTER_VALIDATE_BOOL);
            $hostedDomain = trim((string) ($payload['hd'] ?? ''));
            $isGoogleAuthoritative = str_ends_with($email, '@gmail.com')
                || ($emailVerified && $hostedDomain !== '');

            if ($email === '' || !$emailVerified || !$isGoogleAuthoritative) {
                return response()->json([
                    'message' => 'This Google account cannot be linked automatically. Contact the administrator.',
                ], 403);
            }

            $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

            if (!$user) {
                return response()->json([
                    'message' => 'No system account is registered for this Google email. Contact the administrator.',
                ], 403);
            }

            if ($user->google_id && $user->google_id !== $googleId) {
                return response()->json([
                    'message' => 'This system account is already linked to another Google account.',
                ], 409);
            }

            if (!$user->is_active) {
                return response()->json([
                    'message' => 'Your account has been deactivated.',
                ], 403);
            }

            $user->forceFill([
                'google_id' => $googleId,
                'email_verified_at' => $user->email_verified_at ?? now(),
                'avatar' => $user->avatar ?: ($payload['picture'] ?? null),
            ])->save();
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'Your account has been deactivated.',
            ], 403);
        }

        return $this->authenticatedResponse($user);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => new UserResource($request->user()->load('quarry')),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        AuditLogger::log('logout', 'Auth', $user->name, $user->id);
        $user->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    private function authenticatedResponse(User $user): JsonResponse
    {
        // Keep one active API token per account, matching password sign-in behavior.
        $user->tokens()->delete();
        $token = $user->createToken('auth-token')->plainTextToken;

        // Sanctum has not populated the guard yet on a public login route.
        Auth::setUser($user);
        AuditLogger::log('login', 'Auth', $user->name, $user->id);

        return response()->json([
            'user' => new UserResource($user->load('quarry')),
            'token' => $token,
        ]);
    }
}
