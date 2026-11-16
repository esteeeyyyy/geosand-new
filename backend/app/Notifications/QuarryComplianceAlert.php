<?php

namespace App\Notifications;

use App\Models\Quarry;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class QuarryComplianceAlert extends Notification
{
    use Queueable;

    public function __construct(
        protected Quarry $quarry,
        protected string $alertType,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $expired = $this->alertType === 'permit_expired';
        $expiring = $this->alertType === 'permit_expiring';

        return [
            'title' => $expired ? 'Quarry permit expired' : ($expiring ? 'Quarry permit expiring soon' : 'Quarry compliance alert'),
            'message' => $expired
                ? "{$this->quarry->name} permit {$this->quarry->permit_number} expired on {$this->quarry->permit_expires_at?->format('M d, Y')}. Access and hauling should be restricted until renewal."
                : ($expiring
                    ? "{$this->quarry->name} permit {$this->quarry->permit_number} expires on {$this->quarry->permit_expires_at?->format('M d, Y')}. Submit renewal documents before access is restricted."
                    : "{$this->quarry->name} is marked as illegal or unauthorized. Review the site and restrict operational access."),
            'url' => '/admin/quarries',
            'quarry_id' => $this->quarry->id,
            'alert_type' => $this->alertType,
        ];
    }
}
