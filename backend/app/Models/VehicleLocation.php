<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleLocation extends Model
{
    protected $fillable = [
        'hauling_record_id', 'recorded_by', 'latitude', 'longitude', 'accuracy_m', 'speed_kph', 'heading_degrees', 'captured_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'accuracy_m' => 'decimal:2',
            'speed_kph' => 'decimal:2',
            'heading_degrees' => 'decimal:2',
            'captured_at' => 'datetime',
        ];
    }

    public function haulingRecord(): BelongsTo
    {
        return $this->belongsTo(HaulingRecord::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
