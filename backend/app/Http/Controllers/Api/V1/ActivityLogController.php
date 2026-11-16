<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::with('user')
            ->when($request->module,  fn($q, $v) => $q->where('module',  $v))
            ->when($request->action,  fn($q, $v) => $q->where('action',  $v))
            ->when($request->user_id, fn($q, $v) => $q->where('user_id', $v))
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('user_name', 'like', "%{$search}%")
                      ->orWhere('subject',  'like', "%{$search}%")
                      ->orWhere('module',   'like', "%{$search}%");
                });
            })
            ->when($request->date_from, fn($q, $v) => $q->where('created_at', '>=', $v . ' 00:00:00'))
            ->when($request->date_to,   fn($q, $v) => $q->where('created_at', '<=', $v . ' 23:59:59'))
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 10);

        return response()->json([
            'logs' => $query->map(fn($log) => [
                'id'         => $log->id,
                'user_id'    => $log->user_id,
                'user_name'  => $log->user_name ?? 'System',
                'user_role'  => $log->user_role,
                'action'     => $log->action,
                'module'     => $log->module,
                'subject'    => $log->subject,
                'subject_id' => $log->subject_id,
                'changes'    => $log->changes,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->toISOString(),
            ]),
            'meta' => [
                'current_page' => $query->currentPage(),
                'last_page'    => $query->lastPage(),
                'total'        => $query->total(),
                'per_page'     => $query->perPage(),
            ],
        ]);
    }

    /**
     * Return distinct module names and actions for filter dropdowns.
     */
    public function filters(): JsonResponse
    {
        return response()->json([
            'modules' => ActivityLog::select('module')->distinct()->orderBy('module')->pluck('module'),
            'actions' => ActivityLog::select('action')->distinct()->orderBy('action')->pluck('action'),
        ]);
    }
}
