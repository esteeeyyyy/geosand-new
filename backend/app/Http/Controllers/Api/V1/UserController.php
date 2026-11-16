<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::with('quarry')
            ->when($request->role, fn($q, $r) => $q->where('role', $r))
            ->when($request->search, fn($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%");
            }))
            ->orderBy('name')
            ->paginate($request->per_page ?? 10);

        return response()->json([
            'users' => UserResource::collection($users),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'nullable|string|min:6',
            'role' => ['required', Rule::in(['admin', 'checkpoint_officer', 'quarry_operator', 'quarry_staff'])],
            'quarry_id' => 'nullable|exists:quarries,id',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        // Validate quarry assignment for operator/staff
        if (in_array($validated['role'], ['quarry_operator', 'quarry_staff'])) {
            if (empty($validated['quarry_id'])) {
                return response()->json(['message' => 'Quarry assignment is required for operators and staff.'], 422);
            }

            // Check quarry operator limit (1 per quarry)
            if ($validated['role'] === 'quarry_operator') {
                $existingOperator = User::where('quarry_id', $validated['quarry_id'])
                    ->where('role', 'quarry_operator')
                    ->exists();
                if ($existingOperator) {
                    return response()->json(['message' => 'This quarry already has an operator assigned.'], 422);
                }
            }

            // Check quarry staff limit (5 per quarry)
            if ($validated['role'] === 'quarry_staff') {
                $staffCount = User::where('quarry_id', $validated['quarry_id'])
                    ->where('role', 'quarry_staff')
                    ->count();
                if ($staffCount >= 5) {
                    return response()->json(['message' => 'This quarry already has 5 staff members (maximum).'], 422);
                }
            }
        } else {
            $validated['quarry_id'] = null;
        }

        if (empty($validated['password'])) {
            $validated['password'] = 'password';
        }

        $user = User::create($validated);

        AuditLogger::log('created', 'User', "{$user->name} ({$user->role})", $user->id);

        return response()->json([
            'message' => 'User created successfully.',
            'user' => new UserResource($user->load('quarry')),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', Rule::in(['admin', 'checkpoint_officer', 'quarry_operator', 'quarry_staff'])],
            'quarry_id' => 'nullable|exists:quarries,id',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        $newRole = $validated['role'] ?? $user->role;
        $newQuarryId = array_key_exists('quarry_id', $validated) ? $validated['quarry_id'] : $user->quarry_id;

        // Validate quarry assignment for operator/staff
        if (in_array($newRole, ['quarry_operator', 'quarry_staff'])) {
            if (empty($newQuarryId)) {
                return response()->json(['message' => 'Quarry assignment is required for operators and staff.'], 422);
            }

            if ($newRole === 'quarry_operator' && ($newQuarryId !== $user->quarry_id || $newRole !== $user->role)) {
                $existingOperator = User::where('quarry_id', $newQuarryId)
                    ->where('role', 'quarry_operator')
                    ->where('id', '!=', $user->id)
                    ->exists();
                if ($existingOperator) {
                    return response()->json(['message' => 'This quarry already has an operator assigned.'], 422);
                }
            }

            if ($newRole === 'quarry_staff' && ($newQuarryId !== $user->quarry_id || $newRole !== $user->role)) {
                $staffCount = User::where('quarry_id', $newQuarryId)
                    ->where('role', 'quarry_staff')
                    ->where('id', '!=', $user->id)
                    ->count();
                if ($staffCount >= 5) {
                    return response()->json(['message' => 'This quarry already has 5 staff members (maximum).'], 422);
                }
            }
        } else {
            $validated['quarry_id'] = null;
        }

        $before = $user->toArray();
        $user->update($validated);
        AuditLogger::log('updated', 'User', "{$user->name} ({$user->role})", $user->id, AuditLogger::diff($before, $user->fresh()->toArray()));

        return response()->json([
            'message' => 'User updated successfully.',
            'user' => new UserResource($user->fresh()->load('quarry')),
        ]);
    }

    public function destroy(User $user, Request $request): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        AuditLogger::log('deleted', 'User', "{$user->name} ({$user->role})", $user->id);
        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'User deleted successfully.']);
    }

    // ========================================
    // Operator Staff Management
    // ========================================

    /**
     * List staff belonging to the operator's quarry.
     */
    public function operatorStaffIndex(Request $request): JsonResponse
    {
        $operator = $request->user();

        if (!$operator->quarry_id) {
            return response()->json(['message' => 'No quarry assigned.'], 422);
        }

        $staff = User::with('quarry')
            ->where('quarry_id', $operator->quarry_id)
            ->where('role', 'quarry_staff')
            ->when($request->search, fn($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%");
            }))
            ->orderBy('name')
            ->paginate($request->per_page ?? 10);

        return response()->json([
            'staff' => UserResource::collection($staff),
            'meta' => [
                'current_page' => $staff->currentPage(),
                'last_page' => $staff->lastPage(),
                'total' => $staff->total(),
            ],
        ]);
    }

    /**
     * Operator creates a new staff member for their quarry.
     */
    public function operatorStaffStore(Request $request): JsonResponse
    {
        $operator = $request->user();

        if (!$operator->quarry_id) {
            return response()->json(['message' => 'No quarry assigned.'], 422);
        }

        // Check staff limit (5 per quarry)
        $staffCount = User::where('quarry_id', $operator->quarry_id)
            ->where('role', 'quarry_staff')
            ->count();

        if ($staffCount >= 5) {
            return response()->json(['message' => 'Your quarry already has 5 staff members (maximum).'], 422);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'nullable|string|min:6',
            'phone' => 'nullable|string|max:20',
        ]);

        if (empty($validated['password'])) {
            $validated['password'] = 'password';
        }

        $validated['role'] = 'quarry_staff';
        $validated['quarry_id'] = $operator->quarry_id;
        $validated['is_active'] = true;

        $user = User::create($validated);

        return response()->json([
            'message' => 'Staff member registered successfully.',
            'staff' => new UserResource($user->load('quarry')),
        ], 201);
    }

    /**
     * Operator updates a staff member belonging to their quarry.
     */
    public function operatorStaffUpdate(Request $request, User $user): JsonResponse
    {
        $operator = $request->user();

        // Ensure the staff belongs to the operator's quarry
        if ($user->quarry_id !== $operator->quarry_id || $user->role !== 'quarry_staff') {
            return response()->json(['message' => 'Unauthorized. This staff member does not belong to your quarry.'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:6',
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        if (isset($validated['password']) && empty($validated['password'])) {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'message' => 'Staff member updated successfully.',
            'staff' => new UserResource($user->fresh()->load('quarry')),
        ]);
    }

    /**
     * Operator deletes a staff member belonging to their quarry.
     */
    public function operatorStaffDestroy(Request $request, User $user): JsonResponse
    {
        $operator = $request->user();

        // Ensure the staff belongs to the operator's quarry
        if ($user->quarry_id !== $operator->quarry_id || $user->role !== 'quarry_staff') {
            return response()->json(['message' => 'Unauthorized. This staff member does not belong to your quarry.'], 403);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Staff member removed successfully.']);
    }
}
