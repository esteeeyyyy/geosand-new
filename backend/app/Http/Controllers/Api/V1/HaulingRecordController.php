<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\HaulingRecordResource;
use App\Models\HaulingRecord;
use App\Models\QuarryPermit;
use App\Models\User;
use App\Notifications\NewHaulingRecordSubmitted;
use App\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HaulingRecordController extends Controller
{
    // Admin: all records
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => 'nullable|in:day,week,month,year,all,custom',
            'date_from' => 'nullable|required_if:period,custom|date',
            'date_to' => 'nullable|required_if:period,custom|date|after_or_equal:date_from',
            'quarry_id' => 'nullable|integer|exists:quarries,id',
            'status' => 'nullable|in:pending,verified,rejected',
            'search' => 'nullable|string|max:100',
        ]);

        $period = $validated['period'] ?? 'all';
        $reportingNow = CarbonImmutable::now('Asia/Manila');
        [$dateFrom, $dateTo] = match ($period) {
            'day' => [$reportingNow->startOfDay(), $reportingNow->endOfDay()],
            'week' => [$reportingNow->startOfWeek(), $reportingNow->endOfWeek()],
            'month' => [$reportingNow->startOfMonth(), $reportingNow->endOfMonth()],
            'year' => [$reportingNow->startOfYear(), $reportingNow->endOfYear()],
            'custom' => [
                CarbonImmutable::parse($validated['date_from'], 'Asia/Manila')->startOfDay(),
                CarbonImmutable::parse($validated['date_to'], 'Asia/Manila')->endOfDay(),
            ],
            default => [null, null],
        };

        // Hauling timestamps are stored in the application's timezone (UTC),
        // while report periods follow the municipality's Asia/Manila calendar.
        $dateFrom = $dateFrom?->setTimezone(config('app.timezone'));
        $dateTo = $dateTo?->setTimezone(config('app.timezone'));

        $recordsQuery = HaulingRecord::query()
            ->when($validated['status'] ?? null, fn($q, $s) => $q->where('status', $s))
            ->when($validated['quarry_id'] ?? null, fn($q, $id) => $q->where('quarry_id', $id))
            ->when($validated['search'] ?? null, fn($q, $s) => $q->where('tracking_code', 'like', "%{$s}%"))
            ->when($dateFrom && $dateTo, fn($q) => $q->whereBetween('hauled_at', [$dateFrom, $dateTo]));

        $totalVolume = (clone $recordsQuery)->sum('volume_cubic_meters');
        $records = $recordsQuery
            ->with(['quarry', 'operator', 'verifications.officer', 'verifications.checkpoint'])
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 10);

        return response()->json([
            'hauling_records' => HaulingRecordResource::collection($records),
            'meta' => [
                'current_page' => $records->currentPage(),
                'last_page' => $records->lastPage(),
                'total' => $records->total(),
            ],
            'summary' => [
                'total_volume_cubic_meters' => (float) $totalVolume,
                'total_records' => $records->total(),
            ],
        ]);
    }

    // Operator/Staff: my records
    public function myRecords(Request $request): JsonResponse
    {
        $records = HaulingRecord::with(['quarry', 'verifications.officer', 'verifications.checkpoint'])
            ->where('operator_id', $request->user()->id)
            ->when($request->status, fn($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 10);

        return response()->json([
            'hauling_records' => HaulingRecordResource::collection($records),
            'meta' => [
                'current_page' => $records->currentPage(),
                'last_page' => $records->lastPage(),
                'total' => $records->total(),
            ],
        ]);
    }

    // Operator/Staff: create hauling record (only for assigned quarry)
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->quarry_id) {
            return response()->json(['message' => 'You are not assigned to any quarry.'], 403);
        }

        $quarry = $user->quarry;
        if (!$quarry || in_array($quarry->status, ['illegal', 'inactive', 'pending', 'suspended'], true)) {
            AuditLogger::log('blocked_submission', 'HaulingRecord', $quarry?->name ?? 'Unassigned quarry', $quarry?->id, [
                'reason' => 'restricted_quarry_status',
                'status' => $quarry?->status,
            ]);
            return response()->json([
                'message' => 'Hauling access is restricted because this quarry is not authorized for active operations.',
            ], 403);
        }

        $activePermit = $quarry->permitForDate(now());
        if (!$activePermit) {
            $permitStatus = $quarry->permit_status;
            AuditLogger::log('blocked_submission', 'HaulingRecord', $quarry->name, $quarry->id, [
                'reason' => 'no_active_permit',
                'permit_status' => $permitStatus,
                'permit_issued_at' => $quarry->permit_issued_at?->format('Y-m-d'),
                'permit_expires_at' => $quarry->permit_expires_at?->format('Y-m-d'),
            ]);
            return response()->json([
                'message' => match ($permitStatus) {
                    'not_started' => 'Hauling access is restricted because the quarry permit term has not started.',
                    'suspended' => 'Hauling access is restricted because the quarry permit is suspended.',
                    'cancelled' => 'Hauling access is restricted because the quarry permit is cancelled.',
                    'expired' => 'Hauling access is restricted because the quarry permit has expired. Submit the renewed permit before continuing.',
                    default => 'Hauling access is restricted because the quarry has no active permit.',
                },
            ], 403);
        }

        $validated = $request->validate([
            'truck_plate_number' => 'required|string|max:20',
            'volume_cubic_meters' => 'required|numeric|min:0.01',
            'material_type' => 'required|string|max:100',
            'destination' => 'required|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        // Reserve the requested volume against the current permit term. Pending
        // records count as committed so concurrent submissions cannot exceed it.
        $record = DB::transaction(function () use ($validated, $user): HaulingRecord {
            $today = now()->toDateString();
            $permit = QuarryPermit::query()
                ->where('quarry_id', $user->quarry_id)
                ->where('status', 'active')
                ->whereDate('issued_at', '<=', $today)
                ->whereDate('expires_at', '>=', $today)
                ->orderByDesc('issued_at')
                ->lockForUpdate()
                ->firstOrFail();
            $allowable = $permit->annual_allowable_volume_cubic_meters;

            if ($allowable !== null) {
                $committed = $permit->termVolume(['pending', 'verified']);
                $requested = (float) $validated['volume_cubic_meters'];
                $remaining = max(0, (float) $allowable - $committed);

                if ($requested > $remaining) {
                    throw ValidationException::withMessages([
                        'volume_cubic_meters' => sprintf(
                            'Only %.2f m³ remains in the annual allowable volume for the permit term %s to %s.',
                            $remaining,
                            $permit->issued_at->format('M d, Y'),
                            $permit->expires_at->format('M d, Y')
                        ),
                    ]);
                }
            }

            $recordData = $validated;
            $recordData['quarry_id'] = $user->quarry_id;
            $recordData['permit_id'] = $permit->id;
            $recordData['operator_id'] = $user->id;
            $recordData['hauled_at'] = now();

            return HaulingRecord::create($recordData);
        });
        $record->load(['quarry', 'operator']);

        AuditLogger::log(
            'submitted',
            'HaulingRecord',
            "{$record->tracking_code} — {$record->quarry?->name}",
            $record->id
        );

        // Notify all checkpoint officers
        $officers = User::where('role', 'checkpoint_officer')->where('is_active', true)->get();
        foreach ($officers as $officer) {
            $officer->notify(new NewHaulingRecordSubmitted($record));
        }

        return response()->json([
            'message' => 'Hauling record created successfully.',
            'hauling_record' => new HaulingRecordResource($record),
        ], 201);
    }

    public function show(HaulingRecord $haulingRecord): JsonResponse
    {
        $haulingRecord->load(['quarry', 'operator', 'verifications.officer', 'verifications.checkpoint']);

        return response()->json([
            'hauling_record' => new HaulingRecordResource($haulingRecord),
        ]);
    }

    // Operator/Staff: append a GPS telemetry point for an assigned haul.
    public function updateLocation(Request $request, HaulingRecord $haulingRecord): JsonResponse
    {
        $user = $request->user();
        if (!$user->quarry_id || (int) $haulingRecord->quarry_id !== (int) $user->quarry_id) {
            return response()->json(['message' => 'You cannot update the location of this hauling record.'], 403);
        }

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy_m' => ['nullable', 'numeric', 'min:0'],
            'speed_kph' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'heading_degrees' => ['nullable', 'numeric', 'min:0', 'max:360'],
            'captured_at' => ['nullable', 'date', 'before_or_equal:now'],
        ]);
        $validated['recorded_by'] = $user->id;
        $validated['captured_at'] = $validated['captured_at'] ?? now();

        $location = $haulingRecord->locations()->create($validated);

        return response()->json([
            'message' => 'Vehicle location updated.',
            'location' => $location,
        ], 201);
    }
}
