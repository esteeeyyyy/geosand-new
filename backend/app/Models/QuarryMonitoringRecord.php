<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuarryMonitoringRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'quarry_id',
        'inspection_date',
        'excavation_depth_m',
        'river_setback_m',
        'air_quality_pm25',
        'water_turbidity_ntu',
        'noise_level_db',
        'rehabilitated_area_ha',
        'flood_risk',
        'compliance_status',
        'notes',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'inspection_date' => 'date:Y-m-d',
            'excavation_depth_m' => 'decimal:2',
            'river_setback_m' => 'decimal:2',
            'air_quality_pm25' => 'decimal:2',
            'water_turbidity_ntu' => 'decimal:2',
            'noise_level_db' => 'decimal:2',
            'rehabilitated_area_ha' => 'decimal:2',
        ];
    }

    public function quarry(): BelongsTo
    {
        return $this->belongsTo(Quarry::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
