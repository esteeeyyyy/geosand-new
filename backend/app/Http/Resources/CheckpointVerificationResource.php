<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CheckpointVerificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'hauling_record'  => new HaulingRecordResource($this->whenLoaded('haulingRecord')),
            'checkpoint'      => new CheckpointResource($this->whenLoaded('checkpoint')),
            'officer'         => new UserResource($this->whenLoaded('officer')),
            'status'          => $this->status,
            'remarks'         => $this->remarks,
            'permit_photo_url'=> $this->permit_photo_url,
            'verified_at'     => $this->verified_at?->toISOString(),
            'created_at'      => $this->created_at?->toISOString(),
        ];
    }
}
