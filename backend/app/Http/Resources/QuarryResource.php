<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuarryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $permit = $this->relevantPermit();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'polygon_coordinates' => $this->polygon_coordinates,
            'address' => $this->address,
            'status' => $this->status,
            'area_hectares' => $this->area_hectares ? (float) $this->area_hectares : null,
            'annual_allowable_volume_cubic_meters' => $permit?->annual_allowable_volume_cubic_meters !== null
                ? (float) $permit->annual_allowable_volume_cubic_meters
                : null,
            'permit_number' => $permit?->permit_number,
            'permit_issued_at' => $permit?->issued_at?->format('Y-m-d'),
            'permit_expires_at' => $permit?->expires_at?->format('Y-m-d'),
            'permit_term_consumed_volume_cubic_meters' => $this->whenHas('permit_term_consumed_volume_cubic_meters'),
            'permit_term_committed_volume_cubic_meters' => $this->whenHas('permit_term_committed_volume_cubic_meters'),
            'permit_term_remaining_volume_cubic_meters' => $this->whenHas('permit_term_remaining_volume_cubic_meters'),
            'permit_status' => $this->permit_status,
            'days_until_permit_expiration' => $this->days_until_permit_expiration,
            'current_permit' => $permit ? new QuarryPermitResource($permit) : null,
            'permits' => QuarryPermitResource::collection($this->whenLoaded('permits')),
            'gis_file_url' => $this->gis_file_url,
            'gis_file_name' => $this->gis_file_name,
            'ai_terrain_analysis' => $this->ai_terrain_analysis,
            'created_by' => $this->created_by,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'operator' => new UserResource($this->whenLoaded('operator')),
            'staff' => UserResource::collection($this->whenLoaded('staff')),
            'hauling_count' => $this->whenCounted('haulingRecords'),
            'total_volume' => $this->whenHas('total_volume'),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
