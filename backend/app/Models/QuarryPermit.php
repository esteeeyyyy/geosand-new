<?php

namespace App\Models;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class QuarryPermit extends Model
{
    use HasFactory;

    protected $fillable = [
        'quarry_id',
        'permit_number',
        'issued_at',
        'expires_at',
        'annual_allowable_volume_cubic_meters',
        'status',
        'document_path',
        'created_by',
    ];

    protected static function booted(): void
    {
        static::saving(function (QuarryPermit $permit): void {
            if ($permit->issued_at) {
                $permit->expires_at = static::expirationDate($permit->issued_at)->toDateString();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'issued_at' => 'date:Y-m-d',
            'expires_at' => 'date:Y-m-d',
            'annual_allowable_volume_cubic_meters' => 'decimal:2',
        ];
    }

    public static function expirationDate(CarbonInterface|string $issuedAt): Carbon
    {
        return Carbon::parse($issuedAt)->startOfDay()->addYearNoOverflow();
    }

    public function getEffectiveStatusAttribute(): string
    {
        if (in_array($this->status, ['suspended', 'cancelled'], true)) {
            return $this->status;
        }

        $today = now()->startOfDay();
        if ($this->issued_at->startOfDay()->gt($today)) {
            return 'not_started';
        }
        if ($this->expires_at->startOfDay()->lt($today)) {
            return 'expired';
        }
        if ($this->expires_at->startOfDay()->diffInDays($today) <= 30) {
            return 'expiring_soon';
        }

        return 'active';
    }

    public function getDaysUntilExpirationAttribute(): int
    {
        return (int) now()->startOfDay()->diffInDays($this->expires_at->startOfDay(), false);
    }

    public function getDocumentUrlAttribute(): ?string
    {
        return $this->document_path ? Storage::disk('public')->url($this->document_path) : null;
    }

    public function termVolume(array $statuses = ['verified']): float
    {
        return (float) $this->haulingRecords()
            ->whereIn('status', $statuses)
            ->sum('volume_cubic_meters');
    }

    public function loadUsage(): static
    {
        $consumed = $this->termVolume(['verified']);
        $committed = $this->termVolume(['pending', 'verified']);
        $allowable = $this->annual_allowable_volume_cubic_meters !== null
            ? (float) $this->annual_allowable_volume_cubic_meters
            : null;

        $this->setAttribute('consumed_volume_cubic_meters', round($consumed, 2));
        $this->setAttribute('committed_volume_cubic_meters', round($committed, 2));
        $this->setAttribute(
            'remaining_volume_cubic_meters',
            $allowable === null ? null : round(max(0, $allowable - $committed), 2)
        );

        return $this;
    }

    public function quarry(): BelongsTo
    {
        return $this->belongsTo(Quarry::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function haulingRecords(): HasMany
    {
        return $this->hasMany(HaulingRecord::class, 'permit_id');
    }
}
