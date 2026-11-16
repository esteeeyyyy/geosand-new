<?php

namespace App\Notifications;

use App\Models\HaulingRecord;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class HaulingRecordStatusChanged extends Notification
{
    use Queueable;

    public function __construct(
        protected HaulingRecord $record,
        protected string $status,
        protected ?string $remarks = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $quarryName = $this->record->quarry->name ?? 'Unknown Quarry';
        $trackingCode = $this->record->tracking_code;
        $volume = $this->record->volume_cubic_meters;

        $isVerified = $this->status === 'verified';
        $title = $isVerified
            ? "Hauling Record Verified"
            : "Hauling Record Rejected";

        $message = $isVerified
            ? "Your hauling record {$trackingCode} ({$volume} m³) from {$quarryName} has been verified at checkpoint."
            : "Your hauling record {$trackingCode} ({$volume} m³) from {$quarryName} has been rejected.";

        if ($this->remarks) {
            $message .= " Remarks: {$this->remarks}";
        }

        $role = $notifiable->role;
        $urlPrefix = $role === 'quarry_operator' ? '/operator' : '/staff';

        return [
            'title' => $title,
            'message' => $message,
            'url' => "{$urlPrefix}/history",
            'hauling_record_id' => $this->record->id,
            'tracking_code' => $trackingCode,
            'status' => $this->status,
        ];
    }
}
