<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminUserPasswordUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_change_a_user_password_and_the_user_can_log_in_with_it(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);
        $user = User::factory()->create([
            'email' => 'updated-admin@example.com',
            'role' => 'admin',
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);

        $this->putJson("/api/v1/admin/users/{$user->id}", [
            'password' => 'new-secure-password',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('new-secure-password', $user->password));
        $this->assertFalse(Hash::check('password', $user->password));

        $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'new-secure-password',
        ])->assertOk()->assertJsonStructure(['token']);
    }

    public function test_blank_password_in_an_admin_edit_keeps_the_existing_password(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);
        $user = User::factory()->create([
            'password' => 'existing-password',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $originalHash = $user->password;

        Sanctum::actingAs($admin);

        $this->putJson("/api/v1/admin/users/{$user->id}", [
            'name' => 'Updated Name',
            'password' => '',
        ])->assertOk();

        $user->refresh();
        $this->assertSame('Updated Name', $user->name);
        $this->assertSame($originalHash, $user->password);
        $this->assertTrue(Hash::check('existing-password', $user->password));
    }
}
