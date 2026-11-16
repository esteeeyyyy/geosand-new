<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class CheckpointVerification extends Model
{
    use HasFactory;

    protected $fillable = [
        'hauling_record_id',
        'checkpoint_id',
        'officer_id',
        'status',
        'remarks',
        'permit_photo_path',
        'verified_at',
    ];

    public function getPermitPhotoUrlAttribute(): ?string
    {
        return $this->permit_photo_path
            ? Storage::url($this->permit_photo_path)
            : null;
    }

    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
        ];
    }

    public function haulingRecord(): BelongsTo
    {
        return $this->belongsTo(HaulingRecord::class);
    }

    public function checkpoint(): BelongsTo
    {
        return $this->belongsTo(Checkpoint::class);
    }

    public function officer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'officer_id');
    }
}
