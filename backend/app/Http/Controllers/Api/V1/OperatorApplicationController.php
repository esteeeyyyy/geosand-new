<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OperatorApplicationResource;
use App\Models\OperatorApplication;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperatorApplicationController extends Controller
{
    // Public: submit operator application with file upload
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'applicant_name'  => 'required|string|max:255',
            'company_name'    => 'required|string|max:255',
            'email'           => 'required|email|max:255',
            'phone'           => 'required|string|max:50',
            'quarry_location' => 'required|string|max:255',
            'permit_number'   => 'nullable|string|max:100',
            'remarks'         => 'nullable|string|max:1000',
            'document'        => 'nullable|file|mimes:pdf,doc,docx,jpeg,jpg,png,webp|max:10240',
        ]);

        $documentPath = null;
        $originalName = null;

        if ($request->hasFile('document') && $request->file('document')->isValid()) {
            $file = $request->file('document');
            $originalName = $file->getClientOriginalName();
            $safeName = time() . '_' . strtolower(preg_replace('/[^a-zA-Z0-9._-]/', '_', $originalName));
            $documentPath = $file->storeAs('public/operator-applications/documents', $safeName);
        }

        $application = OperatorApplication::create([
            'applicant_name'         => $validated['applicant_name'],
            'company_name'           => $validated['company_name'],
            'email'                  => $validated['email'],
            'phone'                  => $validated['phone'],
            'quarry_location'        => $validated['quarry_location'],
            'permit_number'          => $validated['permit_number'] ?? null,
            'remarks'                => $validated['remarks'] ?? null,
            'document_path'          => $documentPath,
            'document_original_name' => $originalName,
            'status'                 => 'pending',
        ]);

        AuditLogger::log(
            'applied',
            'OperatorApplication',
            $application->company_name,
            $application->id,
            ['email' => $application->email, 'has_document' => $documentPath ? true : false]
        );

        return response()->json([
            'message' => 'Your operator application has been submitted successfully! The MENRO Admin team will review your application shortly.',
            'application' => new OperatorApplicationResource($application),
        ], 201);
    }

    // Admin: list operator applications
    public function index(Request $request): JsonResponse
    {
        $applications = OperatorApplication::with('reviewer')
            ->when($request->status, fn($q, $status) => $q->where('status', $status))
            ->when($request->search, function ($q, $search) {
                $q->where(function ($sub) use ($search) {
                    $sub->where('applicant_name', 'like', "%{$search}%")
                        ->orWhere('company_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('quarry_location', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 10);

        return response()->json([
            'applications' => OperatorApplicationResource::collection($applications),
            'meta' => [
                'current_page' => $applications->currentPage(),
                'last_page'    => $applications->lastPage(),
                'total'        => $applications->total(),
            ],
        ]);
    }

    // Admin: show single operator application
    public function show(OperatorApplication $application): JsonResponse
    {
        return response()->json([
            'application' => new OperatorApplicationResource($application->load('reviewer')),
        ]);
    }

    // Admin: approve application
    public function approve(Request $request, OperatorApplication $application): JsonResponse
    {
        $validated = $request->validate([
            'admin_remarks' => 'nullable|string|max:1000',
        ]);

        $application->update([
            'status'        => 'approved',
            'admin_remarks' => $validated['admin_remarks'] ?? null,
            'reviewed_by'   => $request->user()->id,
            'reviewed_at'   => now(),
        ]);

        AuditLogger::log(
            'approved',
            'OperatorApplication',
            $application->company_name,
            $application->id,
            ['admin_remarks' => $validated['admin_remarks'] ?? null]
        );

        return response()->json([
            'message'     => 'Operator application approved successfully.',
            'application' => new OperatorApplicationResource($application->fresh('reviewer')),
        ]);
    }

    // Admin: reject application
    public function reject(Request $request, OperatorApplication $application): JsonResponse
    {
        $validated = $request->validate([
            'admin_remarks' => 'required|string|max:1000',
        ]);

        $application->update([
            'status'        => 'rejected',
            'admin_remarks' => $validated['admin_remarks'],
            'reviewed_by'   => $request->user()->id,
            'reviewed_at'   => now(),
        ]);

        AuditLogger::log(
            'rejected',
            'OperatorApplication',
            $application->company_name,
            $application->id,
            ['admin_remarks' => $validated['admin_remarks']]
        );

        return response()->json([
            'message'     => 'Operator application rejected.',
            'application' => new OperatorApplicationResource($application->fresh('reviewer')),
        ]);
    }
}
