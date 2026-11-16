<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SystemMaintenanceController extends Controller
{
    public function index(): JsonResponse
    {
        $backupDirectory = storage_path('app/backups');

        $backups = collect(File::exists($backupDirectory) ? File::files($backupDirectory) : [])
            ->filter(fn ($file) => strtolower($file->getExtension()) === 'json')
            ->sortByDesc(fn ($file) => $file->getMTime())
            ->values()
            ->map(fn ($file) => [
                'name' => $file->getFilename(),
                'size_bytes' => $file->getSize(),
                'created_at' => date(DATE_ATOM, $file->getMTime()),
                'download_url' => url('/api/v1/admin/system/backups/'.rawurlencode($file->getFilename()).'/download'),
            ]);

        return response()->json([
            'backups' => $backups,
            'recovery_ready' => $backups->isNotEmpty(),
            'schedule' => 'Daily at 01:00 Asia/Manila',
            'retention' => '30 most recent snapshots',
        ]);
    }

    public function backup(): JsonResponse
    {
        $exitCode = Artisan::call('geosand:backup');

        if ($exitCode !== 0) {
            return response()->json([
                'message' => 'The backup could not be completed.',
                'details' => trim(Artisan::output()),
            ], 500);
        }

        AuditLogger::log('created_backup', 'System', 'Database snapshot');

        return response()->json([
            'message' => 'System backup created successfully.',
            'details' => trim(Artisan::output()),
        ]);
    }

    public function restore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'string', 'max:255'],
            'confirmation' => ['required', 'in:RESTORE'],
        ]);

        $filename = basename($validated['file']);
        $path = storage_path('app/backups/'.$filename);

        if ($filename !== $validated['file'] || !File::exists($path)) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        // Always preserve the pre-recovery state before replacing current records.
        if (Artisan::call('geosand:backup') !== 0) {
            return response()->json(['message' => 'Recovery stopped because the safety backup failed.'], 500);
        }

        $exitCode = Artisan::call('geosand:restore', ['file' => $filename]);

        if ($exitCode !== 0) {
            return response()->json([
                'message' => 'Recovery did not complete.',
                'details' => trim(Artisan::output()),
            ], 500);
        }

        AuditLogger::log('restored_backup', 'System', $filename);

        return response()->json([
            'message' => 'System data restored successfully.',
            'details' => trim(Artisan::output()),
        ]);
    }

    public function download(string $filename): BinaryFileResponse|JsonResponse
    {
        $safeFilename = basename($filename);
        $path = storage_path('app/backups/'.$safeFilename);

        if ($safeFilename !== $filename || !File::exists($path)) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        return response()->download($path, $safeFilename, [
            'Content-Type' => 'application/json',
        ]);
    }
}
