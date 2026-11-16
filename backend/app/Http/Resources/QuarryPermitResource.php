<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuarryPermitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'permit_number' => $this->permit_number,
            'issued_at' => $this->issued_at?->format('Y-m-d'),
            'expires_at' => $this->expires_at?->format('Y-m-d'),
            'annual_allowable_volume_cubic_meters' => $this->annual_allowable_volume_cubic_meters !== null
                ? (float) $this->annual_allowable_volume_cubic_meters
                : null,
            'status' => $this->status,
            'effective_status' => $this->effective_status,
            'days_until_expiration' => $this->days_until_expiration,
            'consumed_volume_cubic_meters' => $this->whenHas('consumed_volume_cubic_meters'),
            'committed_volume_cubic_meters' => $this->whenHas('committed_volume_cubic_meters'),
            'remaining_volume_cubic_meters' => $this->whenHas('remaining_volume_cubic_meters'),
            'document_url' => $this->document_url,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
