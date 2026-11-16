<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HaulingRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tracking_code' => $this->tracking_code,
            'quarry' => new QuarryResource($this->whenLoaded('quarry')),
            'permit' => new QuarryPermitResource($this->whenLoaded('permit')),
            'operator' => new UserResource($this->whenLoaded('operator')),
            'truck_plate_number' => $this->truck_plate_number,
            'volume_cubic_meters' => (float) $this->volume_cubic_meters,
            'material_type' => $this->material_type,
            'destination' => $this->destination,
            'notes' => $this->notes,
            'status' => $this->status,
            'hauled_at' => $this->hauled_at?->toISOString(),
            'verifications' => CheckpointVerificationResource::collection($this->whenLoaded('verifications')),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
