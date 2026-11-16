<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class OperatorApplication extends Model
{
    use HasFactory;

    protected $fillable = [
        'applicant_name',
        'company_name',
        'email',
        'phone',
        'quarry_location',
        'permit_number',
        'remarks',
        'document_path',
        'document_original_name',
        'status',
        'admin_remarks',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
        ];
    }

    protected $appends = ['document_url'];

    public function getDocumentUrlAttribute(): ?string
    {
        return $this->document_path
            ? Storage::url($this->document_path)
            : null;
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
