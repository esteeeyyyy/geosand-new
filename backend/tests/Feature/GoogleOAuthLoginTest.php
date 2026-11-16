<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\GoogleIdentityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class GoogleOAuthLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_verified_google_email_links_and_signs_in_an_existing_account(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@gmail.com',
            'role' => 'admin',
            'google_id' => null,
            'is_active' => true,
        ]);

        $this->mockGoogleIdentity([
            'sub' => 'google-user-123',
            'email' => 'ADMIN@gmail.com',
            'email_verified' => true,
            'picture' => 'https://example.com/avatar.png',
        ]);

        $response = $this->postJson('/api/v1/auth/google', [
            'credential' => 'valid-google-id-token',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonStructure(['token']);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'google_id' => 'google-user-123',
        ]);
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_returning_user_is_resolved_by_google_subject_id(): void
    {
        $user = User::factory()->create([
            'email' => 'registered@example.com',
            'google_id' => 'stable-google-subject',
            'is_active' => true,
        ]);

        $this->mockGoogleIdentity([
            'sub' => 'stable-google-subject',
            'email' => 'changed@example.com',
            'email_verified' => true,
        ]);

        $this->postJson('/api/v1/auth/google', [
            'credential' => 'valid-google-id-token',
        ])->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_google_sign_in_does_not_create_an_unregistered_system_account(): void
    {
        $this->mockGoogleIdentity([
            'sub' => 'unknown-google-user',
            'email' => 'unknown@gmail.com',
            'email_verified' => true,
        ]);

        $this->postJson('/api/v1/auth/google', [
            'credential' => 'valid-google-id-token',
        ])
            ->assertForbidden()
            ->assertJsonPath('message', 'No system account is registered for this Google email. Contact the administrator.');

        $this->assertDatabaseCount('users', 0);
    }

    public function test_inactive_google_linked_account_cannot_sign_in(): void
    {
        User::factory()->create([
            'google_id' => 'inactive-google-user',
            'is_active' => false,
        ]);

        $this->mockGoogleIdentity([
            'sub' => 'inactive-google-user',
            'email' => 'inactive@gmail.com',
            'email_verified' => true,
        ]);

        $this->postJson('/api/v1/auth/google', [
            'credential' => 'valid-google-id-token',
        ])
            ->assertForbidden()
            ->assertJsonPath('message', 'Your account has been deactivated.');
    }

    public function test_google_sign_in_reports_missing_server_configuration(): void
    {
        config(['services.google.client_id' => null]);

        $this->postJson('/api/v1/auth/google', [
            'credential' => 'any-token',
        ])
            ->assertStatus(503)
            ->assertJsonPath('message', 'Google sign-in is not configured on the server.');
    }

    /** @param array<string, mixed> $payload */
    private function mockGoogleIdentity(array $payload): void
    {
        $this->mock(GoogleIdentityService::class, function (MockInterface $mock) use ($payload): void {
            $mock->shouldReceive('isConfigured')->once()->andReturnTrue();
            $mock->shouldReceive('verifyIdToken')
                ->once()
                ->with('valid-google-id-token')
                ->andReturn($payload);
        });
    }
}
