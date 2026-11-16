<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\QuarryPermitResource;
use App\Models\Quarry;
use App\Models\QuarryPermit;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class QuarryPermitController extends Controller
{
    public function store(Request $request, Quarry $quarry): JsonResponse
    {
        $validated = $request->validate([
            'permit_number' => 'required|string|max:100',
            'issued_at' => 'required|date',
            'annual_allowable_volume_cubic_meters' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:active,suspended,cancelled',
            'document' => 'nullable|file|mimes:pdf,jpeg,jpg,png,webp|max:10240',
        ]);

        $expiresAt = QuarryPermit::expirationDate($validated['issued_at'])->toDateString();
        $this->ensureNoOverlap($quarry, $validated['issued_at'], $expiresAt);

        $permit = DB::transaction(function () use ($request, $validated, $quarry, $expiresAt): QuarryPermit {
            $data = [
                'quarry_id' => $quarry->id,
                'permit_number' => $validated['permit_number'],
                'issued_at' => $validated['issued_at'],
                'expires_at' => $expiresAt,
                'annual_allowable_volume_cubic_meters' => $validated['annual_allowable_volume_cubic_meters'] ?? null,
                'status' => $validated['status'] ?? 'active',
                'created_by' => $request->user()->id,
            ];

            if ($request->hasFile('document')) {
                $file = $request->file('document');
                $data['document_path'] = $file->storeAs(
                    "permits/{$quarry->id}",
                    time().'_'.preg_replace('/[^A-Za-z0-9._-]/', '_', $file->getClientOriginalName()),
                    'public'
                );
            }

            return QuarryPermit::create($data);
        });

        $permit->loadUsage();
        AuditLogger::log('created', 'QuarryPermit', $permit->permit_number, $permit->id, [
            'quarry_id' => $quarry->id,
            'issued_at' => $permit->issued_at->toDateString(),
            'expires_at' => $permit->expires_at->toDateString(),
        ]);

        return response()->json([
            'message' => 'Permit term created successfully.',
            'permit' => new QuarryPermitResource($permit),
        ], 201);
    }

    public function update(Request $request, Quarry $quarry, QuarryPermit $permit): JsonResponse
    {
        abort_unless((int) $permit->quarry_id === (int) $quarry->id, 404);

        $validated = $request->validate([
            'permit_number' => 'sometimes|string|max:100',
            'issued_at' => 'sometimes|date',
            'annual_allowable_volume_cubic_meters' => 'nullable|numeric|min:0',
            'status' => 'sometimes|in:active,suspended,cancelled',
            'document' => 'nullable|file|mimes:pdf,jpeg,jpg,png,webp|max:10240',
        ]);

        $issuedAt = $validated['issued_at'] ?? $permit->issued_at->toDateString();
        $expiresAt = QuarryPermit::expirationDate($issuedAt)->toDateString();

        if (isset($validated['issued_at']) && $permit->haulingRecords()->exists()) {
            throw ValidationException::withMessages([
                'issued_at' => 'The dates of a permit with hauling records cannot be changed.',
            ]);
        }

        $this->ensureNoOverlap($quarry, $issuedAt, $expiresAt, $permit->id);

        if (array_key_exists('annual_allowable_volume_cubic_meters', $validated)
            && $validated['annual_allowable_volume_cubic_meters'] !== null
            && (float) $validated['annual_allowable_volume_cubic_meters'] < $permit->termVolume(['pending', 'verified'])) {
            throw ValidationException::withMessages([
                'annual_allowable_volume_cubic_meters' => 'The allowance cannot be lower than the volume already committed to this permit.',
            ]);
        }

        $before = $permit->toArray();
        $permit->fill($validated);
        $permit->expires_at = $expiresAt;

        if ($request->hasFile('document')) {
            if ($permit->document_path) {
                Storage::disk('public')->delete($permit->document_path);
            }
            $file = $request->file('document');
            $permit->document_path = $file->storeAs(
                "permits/{$quarry->id}",
                time().'_'.preg_replace('/[^A-Za-z0-9._-]/', '_', $file->getClientOriginalName()),
                'public'
            );
        }

        $permit->save();
        $permit->loadUsage();
        AuditLogger::log('updated', 'QuarryPermit', $permit->permit_number, $permit->id, AuditLogger::diff($before, $permit->fresh()->toArray()));

        return response()->json([
            'message' => 'Permit term updated successfully.',
            'permit' => new QuarryPermitResource($permit),
        ]);
    }

    private function ensureNoOverlap(
        Quarry $quarry,
        string $issuedAt,
        string $expiresAt,
        ?int $ignorePermitId = null
    ): void {
        $overlap = $quarry->permits()
            ->where('status', '!=', 'cancelled')
            ->when($ignorePermitId, fn ($query, $id) => $query->where('id', '!=', $id))
            ->whereDate('issued_at', '<=', $expiresAt)
            ->whereDate('expires_at', '>=', $issuedAt)
            ->exists();

        if ($overlap) {
            throw ValidationException::withMessages([
                'issued_at' => 'This one-year permit term overlaps an existing permit for the quarry.',
            ]);
        }
    }
}
