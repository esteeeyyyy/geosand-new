<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CheckpointResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'address' => $this->address,
            'is_active' => $this->is_active,
            'verified_volume_cubic_meters' => (float) ($this->verified_volume_cubic_meters ?? 0),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
