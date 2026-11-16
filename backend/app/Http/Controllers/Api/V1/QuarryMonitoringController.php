<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\QuarryMonitoringRecord;
use App\Models\User;
use App\Notifications\EnvironmentalMonitoringAlert;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuarryMonitoringController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $records = QuarryMonitoringRecord::with(['quarry:id,name', 'recorder:id,name'])
            ->when($request->quarry_id, fn ($query, $quarryId) => $query->where('quarry_id', $quarryId))
            ->when($request->compliance_status, fn ($query, $status) => $query->where('compliance_status', $status))
            ->when($request->start_date, fn ($query, $date) => $query->whereDate('inspection_date', '>=', $date))
            ->when($request->end_date, fn ($query, $date) => $query->whereDate('inspection_date', '<=', $date))
            ->orderByDesc('inspection_date')
            ->orderByDesc('id')
            ->paginate(min((int) $request->get('per_page', 10), 100));

        return response()->json([
            'monitoring_records' => $records->items(),
            'meta' => [
                'current_page' => $records->currentPage(),
                'last_page' => $records->lastPage(),
                'total' => $records->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validated($request);
        $validated['recorded_by'] = $request->user()->id;
        $record = QuarryMonitoringRecord::create($validated);

        AuditLogger::log('recorded_inspection', 'QuarryMonitoring', $record->quarry->name, $record->id, $validated);

        if ($record->compliance_status === 'violation' || $record->flood_risk === 'high') {
            User::where('role', 'admin')->where('is_active', true)->get()
                ->each(fn ($admin) => $admin->notify(new EnvironmentalMonitoringAlert($record)));
        }

        return response()->json([
            'message' => 'Field monitoring inspection recorded.',
            'monitoring_record' => $record->load(['quarry:id,name', 'recorder:id,name']),
        ], 201);
    }

    public function update(Request $request, QuarryMonitoringRecord $monitoringRecord): JsonResponse
    {
        $before = $monitoringRecord->toArray();
        $monitoringRecord->update($this->validated($request));

        AuditLogger::log('updated_inspection', 'QuarryMonitoring', $monitoringRecord->quarry->name, $monitoringRecord->id, AuditLogger::diff($before, $monitoringRecord->fresh()->toArray()));

        return response()->json([
            'message' => 'Field monitoring inspection updated.',
            'monitoring_record' => $monitoringRecord->fresh()->load(['quarry:id,name', 'recorder:id,name']),
        ]);
    }

    public function destroy(QuarryMonitoringRecord $monitoringRecord): JsonResponse
    {
        AuditLogger::log('deleted_inspection', 'QuarryMonitoring', $monitoringRecord->quarry->name, $monitoringRecord->id);
        $monitoringRecord->delete();

        return response()->json(['message' => 'Monitoring inspection deleted.']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'quarry_id' => ['required', 'exists:quarries,id'],
            'inspection_date' => ['required', 'date', 'before_or_equal:today'],
            'excavation_depth_m' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'river_setback_m' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'air_quality_pm25' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'water_turbidity_ntu' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'noise_level_db' => ['nullable', 'numeric', 'min:0', 'max:250'],
            'rehabilitated_area_ha' => ['nullable', 'numeric', 'min:0'],
            'flood_risk' => ['nullable', 'in:low,moderate,high'],
            'compliance_status' => ['required', 'in:compliant,watch,violation'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
