<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    public $timestamps = false; // we manage created_at manually via useCurrent()

    protected $fillable = [
        'user_id',
        'user_name',
        'user_role',
        'action',
        'module',
        'subject',
        'subject_id',
        'changes',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'changes'    => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
