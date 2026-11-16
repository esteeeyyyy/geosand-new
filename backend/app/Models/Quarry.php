<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

class Quarry extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'latitude',
        'longitude',
        'polygon_coordinates',
        'address',
        'status',
        'area_hectares',
        'gis_file_path',
        'created_by',
    ];

    protected ?QuarryPermit $resolvedPermit = null;

    protected bool $permitWasResolved = false;

    /**
     * Public URL to the stored GIS file, or null if none.
     */
    public function getGisFileUrlAttribute(): ?string
    {
        if (!$this->gis_file_path) {
            return null;
        }

        // Point to API endpoint with full CORS and JSON support
        return url("/api/v1/quarries/{$this->id}/gis-file");
    }

    /**
     * Original filename extracted from the stored path.
     */
    public function getGisFileNameAttribute(): ?string
    {
        return $this->gis_file_path
            ? basename($this->gis_file_path)
            : null;
    }

    /**
     * Compute Naive Bayes AI Terrain Classification for the quarry GIS file/polygon.
     */
    public function getAiTerrainAnalysisAttribute(): array
    {
        $classifier = new \App\Services\NaiveBayesTerrainClassifier();
        
        if ($this->gis_file_path) {
            if (Storage::disk('public')->exists($this->gis_file_path)) {
                $content = Storage::disk('public')->get($this->gis_file_path);
                return $classifier->analyzeGisData($content);
            }
            if (Storage::exists($this->gis_file_path)) {
                $content = Storage::get($this->gis_file_path);
                return $classifier->analyzeGisData($content);
            }
        }

        return $classifier->analyzeGisData($this->polygon_coordinates ?? []);
    }

    /**
     * Helper accessor for permit status ('expired', 'expiring_soon', 'active', 'none')
     */
    public function getPermitStatusAttribute(): string
    {
        return $this->relevantPermit()?->effective_status ?? 'none';
    }

    /**
     * Helper accessor for remaining days until permit expires.
     */
    public function getDaysUntilPermitExpirationAttribute(): ?int
    {
        return $this->relevantPermit()?->days_until_expiration;
    }

    /**
     * Permits always end on the same calendar date one year after issuance.
     * Feb. 29 permits end on Feb. 28 in a non-leap expiry year.
     */
    public static function permitExpirationDate(CarbonInterface|string $issuedAt): \Carbon\Carbon
    {
        return QuarryPermit::expirationDate($issuedAt);
    }

    public function relevantPermit(): ?QuarryPermit
    {
        if ($this->permitWasResolved) {
            return $this->resolvedPermit;
        }

        $today = now()->startOfDay();
        $permits = $this->relationLoaded('permits')
            ? $this->permits
            : $this->permits()->orderByDesc('issued_at')->get();

        $this->resolvedPermit = $permits
            ->filter(fn (QuarryPermit $permit) => $permit->issued_at->lte($today) && $permit->expires_at->gte($today))
            ->sortByDesc('issued_at')
            ->first()
            ?? $permits
                ->filter(fn (QuarryPermit $permit) => $permit->issued_at->gt($today))
                ->sortBy('issued_at')
                ->first()
            ?? $permits->sortByDesc('issued_at')->first();

        $this->permitWasResolved = true;

        return $this->resolvedPermit;
    }

    public function permitForDate(CarbonInterface|string $date): ?QuarryPermit
    {
        $dateString = \Carbon\Carbon::parse($date)->toDateString();

        return $this->permits()
            ->where('status', 'active')
            ->whereDate('issued_at', '<=', $dateString)
            ->whereDate('expires_at', '>=', $dateString)
            ->orderByDesc('issued_at')
            ->first();
    }

    public function getPermitNumberAttribute(mixed $legacyValue): ?string
    {
        return $this->relevantPermit()?->permit_number;
    }

    public function getPermitIssuedAtAttribute(mixed $legacyValue): ?CarbonInterface
    {
        return $this->relevantPermit()?->issued_at;
    }

    public function getPermitExpiresAtAttribute(mixed $legacyValue): ?CarbonInterface
    {
        return $this->relevantPermit()?->expires_at;
    }

    public function getAnnualAllowableVolumeCubicMetersAttribute(mixed $legacyValue): ?string
    {
        return $this->relevantPermit()?->annual_allowable_volume_cubic_meters;
    }

    /**
     * Sum hauling volume only within this permit's inclusive one-year term.
     */
    public function permitTermVolume(array $statuses = ['verified']): float
    {
        return $this->relevantPermit()?->termVolume($statuses) ?? 0.0;
    }

    /**
     * Attach permit-term usage values for API resources.
     */
    public function loadPermitTermUsage(bool $includeHistory = false): static
    {
        if (!$this->relationLoaded('permits')) {
            $this->load(['permits' => fn ($query) => $query->orderByDesc('issued_at')]);
        }

        if ($includeHistory) {
            $this->permits->each->loadUsage();
        }

        $permit = $this->relevantPermit();
        $permit?->loadUsage();

        $this->setAttribute('permit_term_consumed_volume_cubic_meters', $permit?->consumed_volume_cubic_meters ?? 0.0);
        $this->setAttribute('permit_term_committed_volume_cubic_meters', $permit?->committed_volume_cubic_meters ?? 0.0);
        $this->setAttribute('permit_term_remaining_volume_cubic_meters', $permit?->remaining_volume_cubic_meters);

        return $this;
    }

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'area_hectares' => 'decimal:2',
            'polygon_coordinates' => 'array',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function haulingRecords(): HasMany
    {
        return $this->hasMany(HaulingRecord::class);
    }

    public function permits(): HasMany
    {
        return $this->hasMany(QuarryPermit::class)->orderByDesc('issued_at');
    }

    public function monitoringRecords(): HasMany
    {
        return $this->hasMany(QuarryMonitoringRecord::class);
    }

    // 1 operator per quarry
    public function operator(): HasOne
    {
        return $this->hasOne(User::class, 'quarry_id')
            ->where('role', 'quarry_operator');
    }

    // Up to 5 staff per quarry
    public function staff(): HasMany
    {
        return $this->hasMany(User::class, 'quarry_id')
            ->where('role', 'quarry_staff');
    }

    // All assigned users (operator + staff)
    public function assignedUsers(): HasMany
    {
        return $this->hasMany(User::class, 'quarry_id')
            ->whereIn('role', ['quarry_operator', 'quarry_staff']);
    }
}
