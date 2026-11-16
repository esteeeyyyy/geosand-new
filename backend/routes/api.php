<?php

use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AnalyticsController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CheckpointController;
use App\Http\Controllers\Api\V1\HaulingRecordController;
use App\Http\Controllers\Api\V1\OperatorApplicationController;
use App\Http\Controllers\Api\V1\QuarryController;
use App\Http\Controllers\Api\V1\QuarryPermitController;
use App\Http\Controllers\Api\V1\QuarryMonitoringController;
use App\Http\Controllers\Api\V1\SystemMaintenanceController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Geosand API Routes
|--------------------------------------------------------------------------
*/

// Public endpoints
Route::prefix('v1')->group(function () {

    // Auth
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/auth/google', [AuthController::class, 'googleLogin'])
        ->middleware('throttle:10,1');

    // Public quarry data
    Route::get('/quarries', [QuarryController::class, 'index']);
    Route::get('/quarries/{quarry}', [QuarryController::class, 'show']);
    Route::get('/quarries/{quarry}/gis-file', [QuarryController::class, 'getGisFile']);
    Route::get('/quarries/{quarry}/ai-terrain-analysis', [QuarryController::class, 'aiTerrainAnalysis']);
    Route::post('/quarries/analyze-gis-elevation', [QuarryController::class, 'analyzeGisElevation']);
    Route::post('/apply-operator', [OperatorApplicationController::class, 'store']);
    Route::post('/operator-applications', [OperatorApplicationController::class, 'store']);

    // Public checkpoints
    Route::get('/checkpoints', [CheckpointController::class, 'index']);

    // Authenticated routes
    Route::middleware('auth:sanctum')->group(function () {

        // Auth
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);

        // Admin routes
        Route::middleware('role:admin')->prefix('admin')->group(function () {
            // User management
            Route::get('/users', [UserController::class, 'index']);
            Route::post('/users', [UserController::class, 'store']);
            Route::put('/users/{user}', [UserController::class, 'update']);
            Route::delete('/users/{user}', [UserController::class, 'destroy']);

            // Operator Applications
            Route::get('/operator-applications', [OperatorApplicationController::class, 'index']);
            Route::get('/operator-applications/{application}', [OperatorApplicationController::class, 'show']);
            Route::post('/operator-applications/{application}/approve', [OperatorApplicationController::class, 'approve']);
            Route::post('/operator-applications/{application}/reject', [OperatorApplicationController::class, 'reject']);

            // Quarry management
            Route::post('/quarries', [QuarryController::class, 'store']);
            Route::put('/quarries/{quarry}', [QuarryController::class, 'update']);
            Route::delete('/quarries/{quarry}', [QuarryController::class, 'destroy']);
            Route::post('/quarries/{quarry}/permits', [QuarryPermitController::class, 'store']);
            Route::put('/quarries/{quarry}/permits/{permit}', [QuarryPermitController::class, 'update']);
            Route::post('/quarries/{quarry}/gis-file', [QuarryController::class, 'uploadGisFile']);
            Route::delete('/quarries/{quarry}/gis-file', [QuarryController::class, 'deleteGisFile']);

            // Hauling records (view all)
            Route::get('/hauling-records', [HaulingRecordController::class, 'index']);
            Route::get('/hauling-records/{haulingRecord}', [HaulingRecordController::class, 'show']);

            // Checkpoints
            Route::post('/checkpoints', [CheckpointController::class, 'store']);
            Route::put('/checkpoints/{checkpoint}', [CheckpointController::class, 'update']);
            Route::delete('/checkpoints/{checkpoint}', [CheckpointController::class, 'destroy']);

            // Analytics
            Route::get('/analytics', [AnalyticsController::class, 'dashboard']);

            // Excavation and environmental field monitoring
            Route::get('/monitoring-records', [QuarryMonitoringController::class, 'index']);
            Route::post('/monitoring-records', [QuarryMonitoringController::class, 'store']);
            Route::put('/monitoring-records/{monitoringRecord}', [QuarryMonitoringController::class, 'update']);
            Route::delete('/monitoring-records/{monitoringRecord}', [QuarryMonitoringController::class, 'destroy']);

            // Audit Logs
            Route::get('/audit-logs', [ActivityLogController::class, 'index']);
            Route::get('/audit-logs/filters', [ActivityLogController::class, 'filters']);

            // Backup and disaster recovery (administrator only)
            Route::get('/system/backups', [SystemMaintenanceController::class, 'index']);
            Route::post('/system/backups', [SystemMaintenanceController::class, 'backup']);
            Route::post('/system/restore', [SystemMaintenanceController::class, 'restore']);
            Route::get('/system/backups/{filename}/download', [SystemMaintenanceController::class, 'download'])
                ->where('filename', '[A-Za-z0-9_.-]+');
        });

        // Operator routes (analytics + hauling + staff management)
        Route::middleware('role:quarry_operator')->prefix('operator')->group(function () {
            Route::get('/hauling-records', [HaulingRecordController::class, 'myRecords']);
            Route::post('/hauling-records', [HaulingRecordController::class, 'store']);
            Route::post('/hauling-records/{haulingRecord}/location', [HaulingRecordController::class, 'updateLocation']);
            Route::get('/my-quarry', [QuarryController::class, 'myQuarry']);
            Route::get('/analytics', [AnalyticsController::class, 'operatorDashboard']);

            // Staff management
            Route::get('/staff', [UserController::class, 'operatorStaffIndex']);
            Route::post('/staff', [UserController::class, 'operatorStaffStore']);
            Route::put('/staff/{user}', [UserController::class, 'operatorStaffUpdate']);
            Route::delete('/staff/{user}', [UserController::class, 'operatorStaffDestroy']);
        });

        // Quarry staff routes (hauling only)
        Route::middleware('role:quarry_staff')->prefix('staff')->group(function () {
            Route::get('/hauling-records', [HaulingRecordController::class, 'myRecords']);
            Route::post('/hauling-records', [HaulingRecordController::class, 'store']);
            Route::post('/hauling-records/{haulingRecord}/location', [HaulingRecordController::class, 'updateLocation']);
            Route::get('/my-quarry', [QuarryController::class, 'myQuarry']);
        });

        // Checkpoint officer routes
        Route::middleware('role:checkpoint_officer')->prefix('checkpoint')->group(function () {
            Route::get('/pending', [CheckpointController::class, 'pending']);
            Route::post('/verify/{haulingRecord}', [CheckpointController::class, 'verify']);
            Route::post('/direct-verify', [CheckpointController::class, 'directVerify']);
            Route::get('/history', [CheckpointController::class, 'history']);
        });

        // Notifications
        Route::prefix('notifications')->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\V1\NotificationController::class, 'index']);
            Route::get('/unread', [\App\Http\Controllers\Api\V1\NotificationController::class, 'unreadCount']);
            Route::post('/read', [\App\Http\Controllers\Api\V1\NotificationController::class, 'markAsRead']);
        });
    });
});
