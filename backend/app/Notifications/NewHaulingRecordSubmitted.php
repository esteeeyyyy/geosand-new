<?php

namespace App\Notifications;

use App\Models\HaulingRecord;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewHaulingRecordSubmitted extends Notification
{
    use Queueable;

    public function __construct(
        protected HaulingRecord $record
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $quarryName = $this->record->quarry->name ?? 'Unknown Quarry';
        $operatorName = $this->record->operator->name ?? 'Unknown';
        $trackingCode = $this->record->tracking_code;
        $volume = $this->record->volume_cubic_meters;
        $material = $this->record->material_type;

        return [
            'title' => "New Hauling Record: {$trackingCode}",
            'message' => "{$operatorName} submitted a hauling record from {$quarryName} — {$volume} m³ of {$material}. Pending verification.",
            'url' => '/checkpoint/dashboard',
            'hauling_record_id' => $this->record->id,
            'tracking_code' => $trackingCode,
        ];
    }
}
