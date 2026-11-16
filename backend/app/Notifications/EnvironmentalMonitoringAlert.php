<?php

namespace App\Notifications;

use App\Models\QuarryMonitoringRecord;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class EnvironmentalMonitoringAlert extends Notification
{
    use Queueable;

    public function __construct(protected QuarryMonitoringRecord $record) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Environmental monitoring action required',
            'message' => "{$this->record->quarry->name} recorded {$this->record->compliance_status} compliance with {$this->record->flood_risk} flood risk on {$this->record->inspection_date?->format('M d, Y')}. Review the field inspection and corrective action notes.",
            'url' => '/admin/monitoring',
            'quarry_id' => $this->record->quarry_id,
            'monitoring_record_id' => $this->record->id,
            'alert_type' => 'environmental_violation',
        ];
    }
}
