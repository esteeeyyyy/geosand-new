<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schedule;
use App\Models\Quarry;
use App\Models\User;
use App\Notifications\QuarryComplianceAlert;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * GeoSand Security & Administration: Automated Data Backup & Disaster Recovery
 * Recommended by Panelist Glenda P. Binay
 */
Artisan::command('geosand:backup', function () {
    $this->info('Starting GeoSand full database backup...');

    $tables = [
        'users',
        'quarries',
        'checkpoints',
        'hauling_records',
        'checkpoint_verifications',
        'operator_applications',
        'activity_logs',
        'notifications',
        'reports',
        'quarry_monitoring_records',
        'vehicle_locations',
    ];

    $backupData = [
        'system' => 'GeoSand GIS Quarry Monitoring System',
        'timestamp' => now()->toIso8601String(),
        'database' => config('database.connections.mysql.database'),
        'tables' => [],
    ];

    $totalRecords = 0;
    foreach ($tables as $table) {
        $records = DB::table($table)->get()->toArray();
        $count = count($records);
        $totalRecords += $count;
        $backupData['tables'][$table] = $records;
        $this->line("  ✓ Backed up [{$table}]: {$count} records");
    }

    $backupDir = storage_path('app/backups');
    if (!File::exists($backupDir)) {
        File::makeDirectory($backupDir, 0755, true);
    }

    $filename = 'geosand_backup_' . now()->format('Y_m_d_His') . '.json';
    $filepath = $backupDir . DIRECTORY_SEPARATOR . $filename;

    File::put($filepath, json_encode($backupData, JSON_PRETTY_PRINT));

    // Keep the 30 newest snapshots so unattended backups cannot fill the disk.
    $snapshots = collect(File::glob($backupDir . '/*.json'))->sortDesc()->values();
    $snapshots->slice(30)->each(fn ($oldFile) => File::delete($oldFile));

    $this->info("Backup successfully completed!");
    $this->info("File: {$filepath}");
    $this->info("Total Records: {$totalRecords}");
})->purpose('Perform full data backup of GeoSand system entities to JSON snapshot');

Artisan::command('geosand:restore {file?}', function ($file = null) {
    $backupDir = storage_path('app/backups');
    
    if (!$file) {
        $files = File::glob($backupDir . '/*.json');
        if (empty($files)) {
            $this->error('No backup files found in ' . $backupDir);
            return 1;
        }
        rsort($files);
        $file = $files[0];
    } else if (!File::exists($file)) {
        $file = $backupDir . DIRECTORY_SEPARATOR . $file;
    }

    if (!File::exists($file)) {
        $this->error("Backup file not found: {$file}");
        return 1;
    }

    $this->warn("Restoring GeoSand data from: {$file}");
    $data = json_decode(File::get($file), true);

    if (!isset($data['tables'])) {
        $this->error('Invalid backup file format.');
        return 1;
    }

    DB::statement('SET FOREIGN_KEY_CHECKS=0;');

    foreach ($data['tables'] as $table => $records) {
        DB::table($table)->truncate();
        if (!empty($records)) {
            $chunks = array_chunk($records, 100);
            foreach ($chunks as $chunk) {
                $insertRows = array_map(function ($row) {
                    return (array) $row;
                }, $chunk);
                DB::table($table)->insert($insertRows);
            }
        }
        $this->line("  ✓ Restored [{$table}]: " . count($records) . " records");
    }

    DB::statement('SET FOREIGN_KEY_CHECKS=1;');

    $this->info("Disaster recovery & data restore completed successfully!");
})->purpose('Restore GeoSand database from latest or specified backup snapshot');

Artisan::command('geosand:compliance-alerts', function () {
    $admins = User::where('role', 'admin')->where('is_active', true)->get();
    $quarries = Quarry::with('operator', 'permits')
        ->where(function ($query) {
            $query->where('status', 'illegal')
                ->orWhereHas('permits', fn ($permit) => $permit
                    ->where('status', 'active')
                    ->whereDate('expires_at', '<=', now()->addDays(30)));
        })
        ->get();

    $sent = 0;
    foreach ($quarries as $quarry) {
        $alertType = $quarry->status === 'illegal'
            ? 'restricted_access'
            : ($quarry->permit_expires_at?->startOfDay()->lt(now()->startOfDay()) ? 'permit_expired' : 'permit_expiring');
        $recipients = $admins->when($quarry->operator, fn ($users) => $users->push($quarry->operator))->unique('id');

        foreach ($recipients as $recipient) {
            $alreadySentToday = $recipient->notifications()
                ->whereDate('created_at', now()->toDateString())
                ->where('data', 'like', '%"quarry_id":'.$quarry->id.'%')
                ->where('data', 'like', '%"alert_type":"'.$alertType.'"%')
                ->exists();

            if (!$alreadySentToday) {
                $recipient->notify(new QuarryComplianceAlert($quarry, $alertType));
                $sent++;
            }
        }
    }

    $this->info("Compliance scan completed. {$sent} alert(s) sent.");
})->purpose('Notify administrators and operators about illegal sites and expired/expiring permits');

Schedule::command('geosand:backup')->dailyAt('01:00')->withoutOverlapping();
Schedule::command('geosand:compliance-alerts')->dailyAt('07:00')->withoutOverlapping();
