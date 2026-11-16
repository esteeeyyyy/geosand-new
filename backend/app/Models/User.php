<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'quarry_id',
        'phone',
        'avatar',
        'google_id',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'google_id',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    // Role helpers
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isOperator(): bool
    {
        return $this->role === 'quarry_operator';
    }

    public function isStaff(): bool
    {
        return $this->role === 'quarry_staff';
    }

    public function isCheckpointOfficer(): bool
    {
        return $this->role === 'checkpoint_officer';
    }

    // Relationships
    public function quarry(): BelongsTo
    {
        return $this->belongsTo(Quarry::class);
    }

    public function haulingRecords(): HasMany
    {
        return $this->hasMany(HaulingRecord::class, 'operator_id');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(CheckpointVerification::class, 'officer_id');
    }

    public function createdQuarries(): HasMany
    {
        return $this->hasMany(Quarry::class, 'created_by');
    }
}
