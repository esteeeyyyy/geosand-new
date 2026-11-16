<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OperatorApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'applicant_name' => $this->applicant_name,
            'company_name' => $this->company_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'quarry_location' => $this->quarry_location,
            'permit_number' => $this->permit_number,
            'remarks' => $this->remarks,
            'document_path' => $this->document_path,
            'document_original_name' => $this->document_original_name,
            'document_url' => $this->document_url,
            'status' => $this->status,
            'admin_remarks' => $this->admin_remarks,
            'reviewed_by' => $this->reviewed_by,
            'reviewer' => new UserResource($this->whenLoaded('reviewer')),
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
