<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CheckpointVerification;
use App\Models\Checkpoint;
use App\Models\HaulingRecord;
use App\Models\Quarry;
use App\Models\QuarryMonitoringRecord;
use App\Models\User;
use App\Services\NaiveBayesAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AnalyticsController extends Controller
{
    public function __construct(private NaiveBayesAnalyticsService $naiveBayes) {}

    public function dashboard(Request $request): JsonResponse
    {
        $period = $request->get('period', 'all');
        $dateFilter = null;
        $endDateFilter = null;
        $groupFormat = '%Y-%m';

        if ($period === 'day') {
            $dateFilter = now()->startOfDay();
            $groupFormat = '%H:00';
        } elseif ($period === 'week') {
            $dateFilter = now()->startOfWeek();
            $groupFormat = '%Y-%m-%d';
        } elseif ($period === 'month') {
            $dateFilter = now()->startOfMonth();
            $groupFormat = '%Y-%m-%d';
        } elseif ($period === 'year') {
            $dateFilter = now()->startOfYear();
            $groupFormat = '%Y-%m';
        } elseif ($period === 'custom') {
            $dateFilter = $request->get('start_date') ? Carbon::parse($request->get('start_date'))->startOfDay() : null;
            $endDateFilter = $request->get('end_date') ? Carbon::parse($request->get('end_date'))->endOfDay() : null;

            if ($dateFilter && $endDateFilter) {
                $diffDays = $dateFilter->diffInDays($endDateFilter);
                if ($diffDays <= 2) {
                    $groupFormat = '%H:00';
                } elseif ($diffDays <= 90) {
                    $groupFormat = '%Y-%m-%d';
                } else {
                    $groupFormat = '%Y-%m';
                }
            } else {
                $groupFormat = '%Y-%m-%d';
            }
        }

        // Base queries
        $haulingQuery = HaulingRecord::query();
        
        if ($dateFilter) {
            $haulingQuery->where('hauled_at', '>=', $dateFilter);
        }
        if ($endDateFilter) {
            $haulingQuery->where('hauled_at', '<=', $endDateFilter);
        }

        // Summary cards with full status tracking (Active, Inactive, Pending, Illegal)
        $stats = [
            'total_quarries' => Quarry::count(),
            'active_quarries' => Quarry::where('status', 'active')->count(),
            'inactive_quarries' => Quarry::where('status', 'inactive')->count(),
            'pending_quarries' => Quarry::where('status', 'pending')->count(),
            'illegal_quarries' => Quarry::where('status', 'illegal')->count(),
            'total_hauling_records' => (clone $haulingQuery)->count(),
            'pending_hauling' => (clone $haulingQuery)->where('status', 'pending')->count(),
            'verified_hauling' => (clone $haulingQuery)->where('status', 'verified')->count(),
            'rejected_hauling' => (clone $haulingQuery)->where('status', 'rejected')->count(),
            'total_volume' => round((float) (clone $haulingQuery)->where('status', 'verified')->sum('volume_cubic_meters'), 2),
            'total_users' => User::count(),
            'active_users' => User::where('is_active', true)->count(),
            'total_checkpoints' => Checkpoint::count(),
            'quarry_status_breakdown' => [
                ['status' => 'Active', 'count' => Quarry::where('status', 'active')->count(), 'color' => '#10B981'],
                ['status' => 'Pending', 'count' => Quarry::where('status', 'pending')->count(), 'color' => '#F59E0B'],
                ['status' => 'Inactive', 'count' => Quarry::where('status', 'inactive')->count(), 'color' => '#9CA3AF'],
                ['status' => 'Illegal', 'count' => Quarry::where('status', 'illegal')->count(), 'color' => '#EF4444'],
            ],
        ];

        // Trend hauling
        $trendHaulingQuery = HaulingRecord::where('status', 'verified');
        if ($dateFilter) {
            $trendHaulingQuery->where('hauled_at', '>=', $dateFilter);
        }
        if ($endDateFilter) {
            $trendHaulingQuery->where('hauled_at', '<=', $endDateFilter);
        }

        $trendHauling = $trendHaulingQuery
            ->select(
                DB::raw("DATE_FORMAT(hauled_at, '{$groupFormat}') as label"),
                DB::raw('SUM(volume_cubic_meters) as total_volume'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('label')
            ->orderBy('label')
            ->get();

        // Volume by quarry
        $volumeByQuarryQuery = Quarry::withSum(['haulingRecords as total_volume' => function ($q) use ($dateFilter, $endDateFilter) {
            $q->where('status', 'verified');
            if ($dateFilter) $q->where('hauled_at', '>=', $dateFilter);
            if ($endDateFilter) $q->where('hauled_at', '<=', $endDateFilter);
        }], 'volume_cubic_meters')
        ->withCount(['haulingRecords as hauling_count' => function ($q) use ($dateFilter, $endDateFilter) {
            $q->where('status', 'verified');
            if ($dateFilter) $q->where('hauled_at', '>=', $dateFilter);
            if ($endDateFilter) $q->where('hauled_at', '<=', $endDateFilter);
        }]);

        $volumeByQuarry = $volumeByQuarryQuery
            ->orderByDesc('total_volume')
            ->limit(10)
            ->get()
            ->map(fn($q) => [
                'name' => $q->name,
                'total_volume' => round((float) ($q->total_volume ?? 0), 2),
                'hauling_count' => $q->hauling_count,
            ]);

        // Trend volume broken down by quarry
        $topQuarryIdsQuery = HaulingRecord::where('status', 'verified');
        if ($dateFilter) $topQuarryIdsQuery->where('hauled_at', '>=', $dateFilter);
        if ($endDateFilter) $topQuarryIdsQuery->where('hauled_at', '<=', $endDateFilter);

        $topQuarryIds = $topQuarryIdsQuery
            ->select('quarry_id', DB::raw('SUM(volume_cubic_meters) as total'))
            ->groupBy('quarry_id')
            ->orderByDesc('total')
            ->limit(6)
            ->pluck('quarry_id');

        $trendByQuarryQuery = DB::table('hauling_records')
            ->join('quarries', 'hauling_records.quarry_id', '=', 'quarries.id')
            ->where('hauling_records.status', 'verified')
            ->whereIn('hauling_records.quarry_id', $topQuarryIds);
        
        if ($dateFilter) {
            $trendByQuarryQuery->where('hauling_records.hauled_at', '>=', $dateFilter);
        }
        if ($endDateFilter) {
            $trendByQuarryQuery->where('hauling_records.hauled_at', '<=', $endDateFilter);
        }

        $trendByQuarryRaw = $trendByQuarryQuery
            ->select(
                DB::raw("DATE_FORMAT(hauled_at, '{$groupFormat}') as label"),
                'quarries.name as quarry_name',
                DB::raw('ROUND(SUM(volume_cubic_meters), 2) as total_volume')
            )
            ->groupBy('label', 'quarries.name')
            ->orderBy('label')
            ->get();

        $trendByQuarry = [
            'rows' => $trendByQuarryRaw,
            'quarries' => $trendByQuarryRaw->pluck('quarry_name')->unique()->values(),
        ];

        // Material type breakdown
        $materialBreakdownQuery = HaulingRecord::where('status', 'verified');
        if ($dateFilter) $materialBreakdownQuery->where('hauled_at', '>=', $dateFilter);
        if ($endDateFilter) $materialBreakdownQuery->where('hauled_at', '<=', $endDateFilter);

        $materialBreakdown = $materialBreakdownQuery
            ->select('material_type', DB::raw('SUM(volume_cubic_meters) as total_volume'), DB::raw('COUNT(*) as count'))
            ->groupBy('material_type')
            ->orderByDesc('total_volume')
            ->get();

        // Ernesto Rodriguez Recommendation: Types of Earth Classification & Economic Reporting
        $unitPrices = [
            'Fine Sand (Vibro)' => 450.00,
            'Coarse Sand' => 380.00,
            'Gravel (3/4)' => 520.00,
            'Base Coarse (G-1)' => 320.00,
            'Crushed Rock (1/2)' => 490.00,
            'River Sand (Unscreened)' => 280.00,
        ];
        $totalVolAll = (float) (clone $haulingQuery)->where('status', 'verified')->sum('volume_cubic_meters') ?: 1.0;
        $typesOfEarth = $materialBreakdown->map(function ($mb) use ($totalVolAll, $unitPrices) {
            $type = $mb->material_type;
            $vol = (float) $mb->total_volume;
            $price = $unitPrices[$type] ?? 350.00;
            $estimatedValue = round($vol * $price, 2);
            $share = round(($vol / $totalVolAll) * 100, 1);
            return [
                'material_type' => $type,
                'total_volume' => $vol,
                'count' => $mb->count,
                'percentage' => $share,
                'estimated_unit_price' => $price,
                'estimated_total_value' => $estimatedValue,
            ];
        });

        // Productivity is intentionally independent from the dashboard period.
        // Always evaluate complete verified monthly history so changing a report
        // filter cannot change the quarry's productivity classification.
        $productivityHistory = HaulingRecord::where('status', 'verified')
            ->select(
                DB::raw("DATE_FORMAT(hauled_at, '%Y-%m') as label"),
                DB::raw('SUM(volume_cubic_meters) as total_volume'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('label')
            ->orderBy('label')
            ->get();

        // Gaussian Naive Bayes productivity classification and class-conditioned forecast.
        $predictiveAnalysis = $this->naiveBayes->analyzeProductivity(
            $productivityHistory->map(fn ($row) => [
                'total_volume' => (float) $row->total_volume,
                'count' => (int) $row->count,
            ])->all()
        );
        $predictiveAnalysis['data_scope'] = 'all_time';
        $predictiveAnalysis['model_info']['data_scope'] = 'All verified hauling history';
        $lastLabel = $productivityHistory->last()?->label ?? now()->format('Y-m');
        try {
            $baseDate = Carbon::createFromFormat('Y-m', substr($lastLabel, 0, 7))->addMonth();
        } catch (\Exception $e) {
            $baseDate = now()->addMonth();
        }
        $predictiveAnalysis['forecast_series'] = collect($predictiveAnalysis['forecast_series'] ?? [])
            ->values()
            ->map(function ($forecast, $index) use ($baseDate) {
                $month = $baseDate->copy()->addMonths($index);
                return array_merge($forecast, [
                    'label' => $month->format('Y-m').' (NB)',
                    'month' => $month->format('M Y'),
                ]);
            })
            ->all();

        /* Legacy fixed environmental estimate removed.

            'slope_stability_index' => '8.2° Mean Gradient (Safe Zone - Grade Green)',
        */
        // Replace baseline estimates with auditable readings and Naive Bayes risk analysis.
        $environmentalQuery = QuarryMonitoringRecord::with('quarry:id,name');
        if ($dateFilter) $environmentalQuery->whereDate('inspection_date', '>=', $dateFilter);
        if ($endDateFilter) $environmentalQuery->whereDate('inspection_date', '<=', $endDateFilter);
        $environmentalRecords = $environmentalQuery
            ->orderByDesc('inspection_date')
            ->orderByDesc('id')
            ->get();
        $setbackReadings = $environmentalRecords->whereNotNull('river_setback_m');
        $turbidityReadings = $environmentalRecords->whereNotNull('water_turbidity_ntu');
        $depthReadings = $environmentalRecords->whereNotNull('excavation_depth_m');
        $airReadings = $environmentalRecords->whereNotNull('air_quality_pm25');
        $noiseReadings = $environmentalRecords->whereNotNull('noise_level_db');
        $floodRisk = $environmentalRecords->whereNotNull('flood_risk')->groupBy('flood_risk')->sortByDesc(fn ($records) => $records->count())->keys()->first();
        $environmentalNaiveBayes = $this->naiveBayes->analyzeEnvironment(
            $environmentalRecords->map(fn ($record) => [
                'river_setback_m' => $record->river_setback_m,
                'water_turbidity_ntu' => $record->water_turbidity_ntu,
                'air_quality_pm25' => $record->air_quality_pm25,
                'noise_level_db' => $record->noise_level_db,
                'excavation_depth_m' => $record->excavation_depth_m,
                'flood_risk' => $record->flood_risk,
            ])->all()
        );

        $environmentalImpact = [
            'inspection_count' => $environmentalRecords->count(),
            'last_inspection_at' => $environmentalRecords->first()?->inspection_date?->format('Y-m-d'),
            'river_setback_compliance_pct' => $setbackReadings->count()
                ? round(($setbackReadings->where('river_setback_m', '>=', 40)->count() / $setbackReadings->count()) * 100, 1)
                : 0,
            'riparian_buffer_zone_meters' => $setbackReadings->count() ? round((float) $setbackReadings->avg('river_setback_m'), 1) : 0,
            'active_setback_violations' => $environmentalRecords->where('compliance_status', 'violation')->count(),
            'flood_plain_hazard_level' => $floodRisk ? ucfirst($floodRisk) : 'Not assessed',
            'sediment_runoff_index' => $turbidityReadings->count() ? round((float) $turbidityReadings->avg('water_turbidity_ntu'), 1).' NTU mean' : 'No field readings',
            'slope_stability_index' => $depthReadings->count() ? round((float) $depthReadings->avg('excavation_depth_m'), 1).' m mean excavation depth' : 'No field readings',
            'air_quality_pm25' => $airReadings->count() ? round((float) $airReadings->avg('air_quality_pm25'), 1) : null,
            'noise_level_db' => $noiseReadings->count() ? round((float) $noiseReadings->avg('noise_level_db'), 1) : null,
            'rehabilitated_area_ha' => round((float) $environmentalRecords->sum('rehabilitated_area_ha'), 2),
            'naive_bayes_analysis' => $environmentalNaiveBayes,
        ];

        $excavationMonitoring = $environmentalRecords
            ->unique('quarry_id')
            ->values()
            ->map(fn ($record) => [
                'id' => $record->id,
                'quarry_id' => $record->quarry_id,
                'quarry_name' => $record->quarry?->name,
                'inspection_date' => $record->inspection_date?->format('Y-m-d'),
                'excavation_depth_m' => $record->excavation_depth_m !== null ? (float) $record->excavation_depth_m : null,
                'river_setback_m' => $record->river_setback_m !== null ? (float) $record->river_setback_m : null,
                'compliance_status' => $record->compliance_status,
                'flood_risk' => $record->flood_risk,
            ]);

        // Logistics & Hauling Route Waypoints (origin quarry -> checkpoint -> destination)
        $haulingRoutes = HaulingRecord::with(['quarry', 'verifications.checkpoint', 'latestLocation'])
            ->whereNotNull('quarry_id')
            ->orderByDesc('hauled_at')
            ->limit(6)
            ->get()
            ->map(function ($h) {
                $checkpoint = $h->verifications->first()?->checkpoint;
                $latestLocation = $h->latestLocation;
                return [
                    'tracking_code' => $h->tracking_code,
                    'status' => $h->status,
                    'material' => $h->material_type,
                    'volume' => (float) $h->volume_cubic_meters,
                    'truck' => $h->truck_plate_number,
                    'origin' => [
                        'name' => $h->quarry->name,
                        'lat' => (float) $h->quarry->latitude,
                        'lng' => (float) $h->quarry->longitude,
                    ],
                    'checkpoint' => $checkpoint ? [
                        'name' => $checkpoint->name,
                        'lat' => (float) $checkpoint->latitude,
                        'lng' => (float) $checkpoint->longitude,
                    ] : null,
                    'current_position' => $latestLocation ? [
                        'lat' => (float) $latestLocation->latitude,
                        'lng' => (float) $latestLocation->longitude,
                        'accuracy_m' => $latestLocation->accuracy_m !== null ? (float) $latestLocation->accuracy_m : null,
                        'speed_kph' => $latestLocation->speed_kph !== null ? (float) $latestLocation->speed_kph : null,
                        'heading_degrees' => $latestLocation->heading_degrees !== null ? (float) $latestLocation->heading_degrees : null,
                        'captured_at' => $latestLocation->captured_at?->toISOString(),
                        'source' => 'gps',
                    ] : null,
                    'destination' => $h->destination,
                ];
            });

        // Recent activity
        $recentHaulingQuery = HaulingRecord::with('quarry', 'operator')
            ->orderByDesc('hauled_at');
        if ($dateFilter) $recentHaulingQuery->where('hauled_at', '>=', $dateFilter);
        if ($endDateFilter) $recentHaulingQuery->where('hauled_at', '<=', $endDateFilter);

        $recentHaulingPaginator = $recentHaulingQuery
            ->orderByDesc('created_at')
            ->paginate(10, ['*'], 'recent_page');
        $recentHauling = $recentHaulingPaginator->getCollection()
            ->map(fn($r) => [
                'id' => $r->id,
                'tracking_code' => $r->tracking_code,
                'quarry' => $r->quarry->name,
                'operator' => $r->operator->name,
                'volume' => (float) $r->volume_cubic_meters,
                'status' => $r->status,
                'created_at' => $r->created_at->toISOString(),
            ]);

        return response()->json([
            'stats' => $stats,
            'trend_hauling' => $trendHauling,
            'trend_by_quarry' => $trendByQuarry,
            'volume_by_quarry' => $volumeByQuarry,
            'material_breakdown' => $materialBreakdown,
            'types_of_earth' => $typesOfEarth,
            'predictive_analysis' => $predictiveAnalysis,
            'productivity_history' => $productivityHistory,
            'environmental_impact' => $environmentalImpact,
            'excavation_monitoring' => $excavationMonitoring,
            'hauling_routes' => $haulingRoutes,
            'recent_hauling' => $recentHauling,
            'recent_hauling_meta' => [
                'current_page' => $recentHaulingPaginator->currentPage(),
                'last_page' => $recentHaulingPaginator->lastPage(),
                'per_page' => $recentHaulingPaginator->perPage(),
                'total' => $recentHaulingPaginator->total(),
            ],
        ]);
    }

    public function operatorDashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $quarryId = $user->quarry_id;

        if (!$quarryId) {
            return response()->json(['message' => 'No quarry assigned.'], 403);
        }

        $quarry = Quarry::withCount('haulingRecords')->find($quarryId);
        $quarry->loadPermitTermUsage();

        // Quarry-scoped stats
        $stats = [
            'total_hauling_records' => HaulingRecord::where('quarry_id', $quarryId)->count(),
            'pending_hauling' => HaulingRecord::where('quarry_id', $quarryId)->where('status', 'pending')->count(),
            'verified_hauling' => HaulingRecord::where('quarry_id', $quarryId)->where('status', 'verified')->count(),
            'rejected_hauling' => HaulingRecord::where('quarry_id', $quarryId)->where('status', 'rejected')->count(),
            'total_volume' => $quarry->permit_term_consumed_volume_cubic_meters,
            'my_records' => HaulingRecord::where('operator_id', $user->id)->count(),
            'quarry_name' => $quarry->name,
            'permit_number' => $quarry->permit_number,
            'permit_issued_at' => $quarry->permit_issued_at?->format('Y-m-d'),
            'permit_expires_at' => $quarry->permit_expires_at?->format('Y-m-d'),
            'annual_allowable_volume_cubic_meters' => $quarry->annual_allowable_volume_cubic_meters !== null
                ? (float) $quarry->annual_allowable_volume_cubic_meters
                : null,
            'permit_term_consumed_volume_cubic_meters' => $quarry->permit_term_consumed_volume_cubic_meters,
            'permit_term_remaining_volume_cubic_meters' => $quarry->permit_term_remaining_volume_cubic_meters,
            'permit_status' => $quarry->permit_status,
            'days_until_permit_expiration' => $quarry->days_until_permit_expiration,
            'staff_count' => User::where('quarry_id', $quarryId)->where('role', 'quarry_staff')->count(),
        ];

        // Monthly hauling for this quarry
        $monthlyHauling = HaulingRecord::where('quarry_id', $quarryId)
            ->where('status', 'verified')
            ->where('hauled_at', '>=', now()->subMonths(12))
            ->select(
                DB::raw("DATE_FORMAT(hauled_at, '%Y-%m') as month"),
                DB::raw('SUM(volume_cubic_meters) as total_volume'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        // Material breakdown for this quarry
        $materialBreakdown = HaulingRecord::where('quarry_id', $quarryId)
            ->where('status', 'verified')
            ->select('material_type', DB::raw('SUM(volume_cubic_meters) as total_volume'), DB::raw('COUNT(*) as count'))
            ->groupBy('material_type')
            ->orderByDesc('total_volume')
            ->get();

        // Recent activity
        $recentHaulingPaginator = HaulingRecord::with(['operator'])
            ->where('quarry_id', $quarryId)
            ->orderByDesc('created_at')
            ->paginate(10, ['*'], 'recent_page');
        $recentHauling = $recentHaulingPaginator->getCollection()
            ->map(fn($r) => [
                'id' => $r->id,
                'tracking_code' => $r->tracking_code,
                'operator' => $r->operator->name,
                'volume' => (float) $r->volume_cubic_meters,
                'material' => $r->material_type,
                'status' => $r->status,
                'created_at' => $r->created_at->toISOString(),
            ]);

        return response()->json([
            'stats' => $stats,
            'monthly_hauling' => $monthlyHauling,
            'material_breakdown' => $materialBreakdown,
            'recent_hauling' => $recentHauling,
            'recent_hauling_meta' => [
                'current_page' => $recentHaulingPaginator->currentPage(),
                'last_page' => $recentHaulingPaginator->lastPage(),
                'per_page' => $recentHaulingPaginator->perPage(),
                'total' => $recentHaulingPaginator->total(),
            ],
        ]);
    }
}
