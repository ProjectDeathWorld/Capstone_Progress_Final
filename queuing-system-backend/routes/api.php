<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\QueueController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\KpiController;
use App\Http\Controllers\Api\CustomersServedController;
use App\Http\Controllers\Api\DisplayConfigurationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\WindowController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\IntelligenceController;

Route::get('/health/database', function () {
    $database = env('DB_DATABASE', 'laravel');

    try {
        DB::connection()->getPdo();

        return response()->json([
            'database' => $database,
            'status' => 'Connected',
        ]);
    } catch (\Throwable $exception) {
        return response()->json([
            'database' => $database,
            'status' => 'Disconnected',
            'message' => 'Database connection unavailable. Please make sure MySQL is running.',
        ], 503);
    }
});

Route::get('/reports', [ReportController::class, 'getReport']);
Route::get('/windows/availability', [WindowController::class, 'index']);
Route::get('/service-windows', [WindowController::class, 'index']);
Route::get('/activity-logs', [ActivityLogController::class, 'getActivityLogs']);
Route::get('/queue-history', [ActivityLogController::class, 'getQueueHistory']);
Route::get('/students/{studentNumber}', [StudentController::class, 'show'])
    ->where('studentNumber', '\\d{4}-23');


Route::post('/login', [AuthController::class, 'login']);


Route::post('/queue/generate', [QueueController::class, 'generateTicket']);
Route::post('/queue/{id}/print', [QueueController::class, 'printTicket']);
Route::get('/queue/waiting', [QueueController::class, 'getWaitingTickets']);
Route::get('/queue/serving', [QueueController::class, 'getServingTickets']);
Route::get('/queue/monitoring', [QueueController::class, 'getMonitoring']);
Route::post('/queue/verify-security', [QueueController::class, 'verifySecurityCode']);
Route::get('/display-configuration', [DisplayConfigurationController::class, 'show']);


Route::middleware(['auth:sanctum', \App\Http\Middleware\EnsureDepartmentEnabled::class])->group(function () {
    
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/staff/window', [WindowController::class, 'assigned']);
    Route::get('/staff/current-window', [WindowController::class, 'currentWindow']);
    Route::get('/staff/current-ticket', [QueueController::class, 'getCurrentTicket']);
    Route::get('/staff/queue/waiting', [QueueController::class, 'getStaffWaitingTickets']);
    Route::put('/staff/window', [WindowController::class, 'updateAssigned']);
    Route::patch('/staff/window/status', [WindowController::class, 'updateAssignedStatus']);
    Route::post('/windows/toggle', [WindowController::class, 'toggleAvailability']);
    Route::put('/display-configuration', [DisplayConfigurationController::class, 'update']);
    Route::post('/display-configuration/upload', [DisplayConfigurationController::class, 'upload']);

    
    Route::get('/queue', [QueueController::class, 'getAllTickets']);
    Route::post('/queue/call', [QueueController::class, 'callNextTicket']);
    Route::put('/queue/{id}/complete', [QueueController::class, 'completeTicket']);
    Route::put('/queue/{id}/cancel', [QueueController::class, 'cancelTicket']);

    // Staff management
    Route::get('/staff', [StaffController::class, 'index']);
    Route::get('/staff/{id}', [StaffController::class, 'show']);
    Route::put('/staff/{id}', [StaffController::class, 'update']);
    Route::delete('/staff/{id}', [StaffController::class, 'destroy']);
    Route::get('/staff/{id}/performance', [StaffController::class, 'getPerformance']);

    // KPI & Analytics
    Route::post('/kpi/generate', [KpiController::class, 'generateKpi']);
    Route::get('/kpi', [KpiController::class, 'index']);
    Route::get('/kpi/staff/{id}', [KpiController::class, 'getByStaff']);
    Route::get('/analytics/dashboard', [KpiController::class, 'getDashboardAnalytics']);
    Route::get('/analytics/busiest-day', [KpiController::class, 'getBusiestDayAnalytics']);
    Route::get('/analytics/department-comparison', [KpiController::class, 'getDepartmentComparison']);
    Route::get('/analytics/transactions', [KpiController::class, 'getTransactionAnalytics']);
    Route::get('/analytics/peak-hours', [KpiController::class, 'getPeakHours']);

    // Customers Served Per Day
    Route::get('/analytics/customers-served', [CustomersServedController::class, 'index']);

    // Intelligence & Predictions
    Route::get('/intelligence/predicted-wait', [IntelligenceController::class, 'getPredictedWaitTime']);
    Route::get('/intelligence/peak-hours', [IntelligenceController::class, 'getPeakHoursPrediction']);
});
