<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CheckpointResource;
use App\Http\Resources\CheckpointVerificationResource;
use App\Http\Resources\HaulingRecordResource;
use App\Models\Checkpoint;
use App\Models\CheckpointVerification;
use App\Models\HaulingRecord;
use App\Models\Quarry;
use App\Models\QuarryPermit;
use App\Models\User;
use App\Notifications\HaulingRecordStatusChanged;
use App\Services\AuditLogger;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CheckpointController extends Controller
{
    // List all checkpoints
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => 'nullable|in:day,week,month,year,all,custom',
            'start_date' => 'nullable|required_if:period,custom|date',
            'end_date' => 'nullable|required_if:period,custom|date|after_or_equal:start_date',
            'material_type' => 'nullable|string|max:100',
        ]);

        $period = $validated['period'] ?? 'all';
        $startDate = match ($period) {
            'day' => now()->startOfDay(),
            'week' => now()->startOfWeek(),
            'month' => now()->startOfMonth(),
            'year' => now()->startOfYear(),
            'custom' => Carbon::parse($validated['start_date'])->startOfDay(),
            default => null,
        };
        $endDate = $period === 'custom'
            ? Carbon::parse($validated['end_date'])->endOfDay()
            : null;

        $verifiedVolume = HaulingRecord::query()
            ->selectRaw('COALESCE(SUM(volume_cubic_meters), 0)')
            ->where('hauling_records.status', 'verified')
            ->when($startDate, fn ($query, $date) => $query->where('hauling_records.hauled_at', '>=', $date))
            ->whereExists(function ($query) {
                $query->selectRaw('1')
                    ->from('checkpoint_verifications')
                    ->whereColumn('checkpoint_verifications.hauling_record_id', 'hauling_records.id')
                    ->whereColumn('checkpoint_verifications.checkpoint_id', 'checkpoints.id')
                    ->where('checkpoint_verifications.status', 'verified');
            });

        if ($endDate) {
            $verifiedVolume->where('hauling_records.hauled_at', '<=', $endDate);
        }

        if (!empty($validated['material_type'])) {
            $verifiedVolume->where('hauling_records.material_type', $validated['material_type']);
        }

        $checkpoints = Checkpoint::query()
            ->addSelect(['verified_volume_cubic_meters' => $verifiedVolume])
            ->orderBy('name')
            ->paginate($request->per_page ?? 10);

        return response()->json([
            'checkpoints' => CheckpointResource::collection($checkpoints),
            'meta' => [
                'current_page' => $checkpoints->currentPage(),
                'last_page' => $checkpoints->lastPage(),
                'total' => $checkpoints->total(),
            ],
            'material_types' => HaulingRecord::query()
                ->whereNotNull('material_type')
                ->where('material_type', '!=', '')
                ->distinct()
                ->orderBy('material_type')
                ->pluck('material_type'),
        ]);
    }

    // Admin: create checkpoint
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'address' => 'nullable|string|max:500',
            'is_active' => 'boolean',
        ]);

        $checkpoint = Checkpoint::create($validated);

        AuditLogger::log('created', 'Checkpoint', $checkpoint->name, $checkpoint->id);

        return response()->json([
            'message' => 'Checkpoint created successfully.',
            'checkpoint' => new CheckpointResource($checkpoint),
        ], 201);
    }

    // Admin: update checkpoint
    public function update(Request $request, Checkpoint $checkpoint): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'latitude' => 'sometimes|numeric|between:-90,90',
            'longitude' => 'sometimes|numeric|between:-180,180',
            'address' => 'nullable|string|max:500',
            'is_active' => 'boolean',
        ]);

        $before = $checkpoint->toArray();
        $checkpoint->update($validated);
        AuditLogger::log('updated', 'Checkpoint', $checkpoint->name, $checkpoint->id, AuditLogger::diff($before, $checkpoint->fresh()->toArray()));

        return response()->json([
            'message' => 'Checkpoint updated successfully.',
            'checkpoint' => new CheckpointResource($checkpoint->fresh()),
        ]);
    }

    // Admin: delete checkpoint
    public function destroy(Checkpoint $checkpoint): JsonResponse
    {
        AuditLogger::log('deleted', 'Checkpoint', $checkpoint->name, $checkpoint->id);
        $checkpoint->delete();
        return response()->json(['message' => 'Checkpoint deleted successfully.']);
    }

    // Checkpoint officer: pending hauling records
    public function pending(Request $request): JsonResponse
    {
        $records = HaulingRecord::with(['quarry', 'operator'])
            ->where('status', 'pending')
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

    // Checkpoint officer: verify or reject
    public function verify(Request $request, HaulingRecord $haulingRecord): JsonResponse
    {
        $validated = $request->validate([
            'checkpoint_id' => 'required|exists:checkpoints,id',
            'status'        => 'required|in:verified,rejected',
            'remarks'       => 'nullable|string|max:1000',
            'permit_photo'  => 'nullable|file|mimes:jpeg,jpg,png,webp|max:8192',
        ]);

        // Store permit photo if provided
        $photoPath = null;
        if ($request->hasFile('permit_photo') && $request->file('permit_photo')->isValid()) {
            $file      = $request->file('permit_photo');
            $safeName  = $haulingRecord->id . '_' . time() . '.' . strtolower($file->getClientOriginalExtension());
            $photoPath = $file->storeAs('public/permit-photos/' . $haulingRecord->id, $safeName);
        }

        $verification = CheckpointVerification::create([
            'hauling_record_id' => $haulingRecord->id,
            'checkpoint_id'     => $validated['checkpoint_id'],
            'officer_id'        => $request->user()->id,
            'status'            => $validated['status'],
            'remarks'           => $validated['remarks'] ?? null,
            'permit_photo_path' => $photoPath,
            'verified_at'       => now(),
        ]);

        // Update hauling record status
        $haulingRecord->update(['status' => $validated['status']]);

        AuditLogger::log(
            $validated['status'],
            'HaulingRecord',
            $haulingRecord->tracking_code,
            $haulingRecord->id,
            ['remarks' => $validated['remarks'] ?? null, 'permit_photo' => $photoPath ? 'yes' : 'no']
        );

        // Notify the operator and quarry staff
        $haulingRecord->load('quarry');
        $recipients = User::where(function ($q) use ($haulingRecord) {
            $q->where('id', $haulingRecord->operator_id)
              ->orWhere(function ($q2) use ($haulingRecord) {
                  $q2->where('quarry_id', $haulingRecord->quarry_id)
                     ->whereIn('role', ['quarry_operator', 'quarry_staff']);
              });
        })->get()->unique('id');

        foreach ($recipients as $recipient) {
            $recipient->notify(new HaulingRecordStatusChanged(
                $haulingRecord,
                $validated['status'],
                $validated['remarks'] ?? null
            ));
        }

        return response()->json([
            'message'      => 'Hauling record ' . $validated['status'] . ' successfully.',
            'verification' => new CheckpointVerificationResource(
                $verification->load(['haulingRecord.quarry', 'haulingRecord.operator', 'checkpoint', 'officer'])
            ),
        ]);
    }

    // Checkpoint officer: direct on-the-spot hauling record creation & verification
    public function directVerify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'quarry_id'           => 'required|exists:quarries,id',
            'truck_plate_number'  => 'required|string|max:50',
            'volume_cubic_meters' => 'required|numeric|min:0.1',
            'material_type'       => 'required|string|max:100',
            'destination'         => 'required|string|max:255',
            'driver_name'         => 'nullable|string|max:255',
            'notes'               => 'nullable|string|max:1000',
            'checkpoint_id'       => 'required|exists:checkpoints,id',
            'status'              => 'required|in:verified,rejected',
            'remarks'             => 'nullable|string|max:1000',
            'permit_photo'        => 'nullable|file|mimes:jpeg,jpg,png,webp|max:8192',
        ]);

        $quarry = Quarry::findOrFail($validated['quarry_id']);
        $operatorId = $quarry->operator?->id ?? $request->user()->id;
        $hauledAt = now();
        $permit = $quarry->permitForDate($hauledAt);

        if ($validated['status'] === 'verified' && !$permit) {
            throw ValidationException::withMessages([
                'quarry_id' => 'The quarry has no active permit for the current hauling date.',
            ]);
        }

        $trackingCode = 'GS-' . date('Ymd') . '-' . strtoupper(\Illuminate\Support\Str::random(4));

        $haulingRecord = DB::transaction(function () use ($validated, $operatorId, $trackingCode, $hauledAt, $permit): HaulingRecord {
            $lockedPermit = $permit
                ? QuarryPermit::query()->lockForUpdate()->findOrFail($permit->id)
                : null;

            if ($validated['status'] === 'verified' && $lockedPermit?->annual_allowable_volume_cubic_meters !== null) {
                $committed = $lockedPermit->termVolume(['pending', 'verified']);
                $remaining = max(0, (float) $lockedPermit->annual_allowable_volume_cubic_meters - $committed);

                if ((float) $validated['volume_cubic_meters'] > $remaining) {
                    throw ValidationException::withMessages([
                        'volume_cubic_meters' => sprintf(
                            'Only %.2f m³ remains in the annual allowable volume for this permit term.',
                            $remaining
                        ),
                    ]);
                }
            }

            return HaulingRecord::create([
                'tracking_code'       => $trackingCode,
                'quarry_id'           => $validated['quarry_id'],
                'permit_id'           => $lockedPermit?->id,
                'operator_id'         => $operatorId,
                'truck_plate_number'  => strtoupper($validated['truck_plate_number']),
                'volume_cubic_meters' => $validated['volume_cubic_meters'],
                'material_type'       => $validated['material_type'],
                'destination'         => $validated['destination'],
                'driver_name'         => $validated['driver_name'] ?? null,
                'notes'               => $validated['notes'] ?? null,
                'hauled_at'           => $hauledAt,
                'status'              => $validated['status'],
            ]);
        });

        $photoPath = null;
        if ($request->hasFile('permit_photo') && $request->file('permit_photo')->isValid()) {
            $file      = $request->file('permit_photo');
            $safeName  = $haulingRecord->id . '_' . time() . '.' . strtolower($file->getClientOriginalExtension());
            $photoPath = $file->storeAs('public/permit-photos/' . $haulingRecord->id, $safeName);
        }

        $verification = CheckpointVerification::create([
            'hauling_record_id' => $haulingRecord->id,
            'checkpoint_id'     => $validated['checkpoint_id'],
            'officer_id'        => $request->user()->id,
            'status'            => $validated['status'],
            'remarks'           => $validated['remarks'] ?? null,
            'permit_photo_path' => $photoPath,
            'verified_at'       => now(),
        ]);

        AuditLogger::log(
            'direct_' . $validated['status'],
            'HaulingRecord',
            $haulingRecord->tracking_code,
            $haulingRecord->id,
            ['remarks' => $validated['remarks'] ?? null, 'on_the_spot' => true]
        );

        $recipients = User::where(function ($q) use ($haulingRecord) {
            $q->where('id', $haulingRecord->operator_id)
              ->orWhere(function ($q2) use ($haulingRecord) {
                  $q2->where('quarry_id', $haulingRecord->quarry_id)
                     ->whereIn('role', ['quarry_operator', 'quarry_staff']);
              });
        })->get()->unique('id');

        foreach ($recipients as $recipient) {
            $recipient->notify(new HaulingRecordStatusChanged(
                $haulingRecord,
                $validated['status'],
                'On-the-spot verification at checkpoint: ' . ($validated['remarks'] ?? 'N/A')
            ));
        }

        return response()->json([
            'message'      => 'Hauling record logged and ' . $validated['status'] . ' on the spot.',
            'verification' => new CheckpointVerificationResource(
                $verification->load(['haulingRecord.quarry', 'haulingRecord.operator', 'checkpoint', 'officer'])
            ),
        ], 201);
    }

    // Checkpoint officer: verification history
    public function history(Request $request): JsonResponse
    {
        $verifications = CheckpointVerification::with(['haulingRecord.quarry', 'haulingRecord.operator', 'checkpoint', 'officer'])
            ->where('officer_id', $request->user()->id)
            ->orderByDesc('verified_at')
            ->paginate($request->per_page ?? 10);

        return response()->json([
            'verifications' => CheckpointVerificationResource::collection($verifications),
            'meta' => [
                'current_page' => $verifications->currentPage(),
                'last_page' => $verifications->lastPage(),
                'total' => $verifications->total(),
            ],
        ]);
    }
}
