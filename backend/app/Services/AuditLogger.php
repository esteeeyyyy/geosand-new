<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request as RequestFacade;

class AuditLogger
{
    /**
     * Log an action.
     *
     * @param string      $action     e.g. "created", "updated", "deleted", "login", "logout"
     * @param string      $module     e.g. "Quarry", "User", "HaulingRecord"
     * @param string|null $subject    Human-readable label of the target entity
     * @param int|null    $subjectId  Primary key of the target entity
     * @param array|null  $changes    ['before' => [...], 'after' => [...]] for updates
     */
    public static function log(
        string  $action,
        string  $module,
        ?string $subject    = null,
        ?int    $subjectId  = null,
        ?array  $changes    = null,
    ): void {
        $user = Auth::user();

        ActivityLog::create([
            'user_id'    => $user?->id,
            'user_name'  => $user?->name,
            'user_role'  => $user?->role,
            'action'     => $action,
            'module'     => $module,
            'subject'    => $subject,
            'subject_id' => $subjectId,
            'changes'    => $changes,
            'ip_address' => RequestFacade::ip(),
            'user_agent' => RequestFacade::userAgent(),
        ]);
    }

    /**
     * Compute a filtered before/after diff between two attribute arrays.
     * Excludes timestamps and large blobs (polygon_coordinates, gis_file_path).
     */
    public static function diff(array $before, array $after): array
    {
        $skip = ['updated_at', 'created_at', 'polygon_coordinates', 'gis_file_path'];

        $b = array_diff_key($before, array_flip($skip));
        $a = array_diff_key($after,  array_flip($skip));

        $changedBefore = [];
        $changedAfter  = [];

        foreach ($a as $key => $newVal) {
            $oldVal = $b[$key] ?? null;
            if ((string) $oldVal !== (string) $newVal) {
                $changedBefore[$key] = $oldVal;
                $changedAfter[$key]  = $newVal;
            }
        }

        return ['before' => $changedBefore, 'after' => $changedAfter];
    }
}
