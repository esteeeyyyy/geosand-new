<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class HaulingRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'tracking_code',
        'quarry_id',
        'permit_id',
        'operator_id',
        'truck_plate_number',
        'volume_cubic_meters',
        'material_type',
        'destination',
        'notes',
        'status',
        'hauled_at',
    ];

    protected function casts(): array
    {
        return [
            'volume_cubic_meters' => 'decimal:2',
            'hauled_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (HaulingRecord $record) {
            if (empty($record->tracking_code)) {
                $record->tracking_code = 'GS-' . strtoupper(Str::random(8));
            }
        });
    }

    public function quarry(): BelongsTo
    {
        return $this->belongsTo(Quarry::class);
    }

    public function permit(): BelongsTo
    {
        return $this->belongsTo(QuarryPermit::class, 'permit_id');
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(CheckpointVerification::class);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(VehicleLocation::class);
    }

    public function latestLocation(): HasOne
    {
        return $this->hasOne(VehicleLocation::class)->latestOfMany('captured_at');
    }
}
