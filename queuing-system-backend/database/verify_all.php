<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\QueueTicket;
use App\Models\ServiceTransaction;
use App\Models\DisplaySetting;

echo "=== 1. VERIFYING DATABASE TABLES & COUNTS ===" . PHP_EOL;
$ticketsCount = DB::table('queue_tickets')->count();
$transactionsCount = DB::table('service_transactions')->count();
$callingLogsCount = DB::table('service_logs')
    ->where(function ($q) {
        $q->where('action', 'LIKE', 'Called ticket:%')
          ->orWhere('action', 'LIKE', 'Completed ticket:%')
          ->orWhere('action', 'LIKE', 'Skipped / no show:%');
    })->count();

echo "queue_tickets count:        {$ticketsCount} (Expected: 0)" . PHP_EOL;
echo "service_transactions count: {$transactionsCount} (Expected: 0)" . PHP_EOL;
echo "ticket calling logs count:  {$callingLogsCount} (Expected: 0)" . PHP_EOL;

assert($ticketsCount === 0, 'queue_tickets must be 0');
assert($transactionsCount === 0, 'service_transactions must be 0');
assert($callingLogsCount === 0, 'ticket calling logs must be 0');
echo "✓ Queue and transaction tables are completely empty." . PHP_EOL;

echo PHP_EOL . "=== 2. VERIFYING ANALYTICS & DASHBOARD KPIs ===" . PHP_EOL;
$request = \Illuminate\Http\Request::create('/api/kpi/dashboard-analytics', 'GET');
$kpiController = new \App\Http\Controllers\Api\KpiController();
$dashboardResponse = $kpiController->getDashboardAnalytics($request);
$dashboardData = $dashboardResponse->getData();

echo "Total Tickets:     " . ($dashboardData->total_tickets ?? 'N/A') . " (Expected: 0)" . PHP_EOL;
echo "Waiting Tickets:   " . ($dashboardData->waiting_tickets ?? 'N/A') . " (Expected: 0)" . PHP_EOL;
echo "Serving Tickets:   " . ($dashboardData->serving_tickets ?? 'N/A') . " (Expected: 0)" . PHP_EOL;
echo "Completed Tickets: " . ($dashboardData->completed_tickets ?? 'N/A') . " (Expected: 0)" . PHP_EOL;
echo "Cancelled Tickets: " . ($dashboardData->cancelled_tickets ?? 'N/A') . " (Expected: 0)" . PHP_EOL;

assert(($dashboardData->total_tickets ?? 0) === 0, 'total_tickets must be 0');
assert(($dashboardData->waiting_tickets ?? 0) === 0, 'waiting_tickets must be 0');
assert(($dashboardData->serving_tickets ?? 0) === 0, 'serving_tickets must be 0');
assert(($dashboardData->completed_tickets ?? 0) === 0, 'completed_tickets must be 0');
echo "✓ Transaction-based analytics and dashboard KPIs are completely 0 / empty." . PHP_EOL;

echo PHP_EOL . "=== 3. VERIFYING QUEUE HISTORY ===" . PHP_EOL;
$historyReq = \Illuminate\Http\Request::create('/api/queue-history', 'GET', ['period' => 'all']);
$actLogController = new \App\Http\Controllers\Api\ActivityLogController();
$historyResponse = $actLogController->getQueueHistory($historyReq);
$historyData = $historyResponse->getData();

echo "Queue History Records Count: " . count($historyData) . " (Expected: 0)" . PHP_EOL;
assert(count($historyData) === 0, 'Queue history must be empty');
echo "✓ Queue history is completely empty." . PHP_EOL;

echo PHP_EOL . "=== 4. VERIFYING ACCOUNTS STILL WORK ===" . PHP_EOL;
$admin = User::where('username', 'admin')->first();
echo "Admin user exists: " . ($admin ? 'YES' : 'NO') . PHP_EOL;
assert($admin !== null, 'Admin user must exist');

// Test password verify (password: admin123)
$authCheck = Hash::check('admin123', $admin->password);
echo "Admin password valid ('admin123'): " . ($authCheck ? 'YES' : 'NO') . PHP_EOL;
assert($authCheck === true, 'Admin password must verify');

$cashier = User::where('username', 'cashier1')->first();
$cashierCheck = $cashier && Hash::check('staff123', $cashier->password);
echo "Cashier1 password valid ('staff123'): " . ($cashierCheck ? 'YES' : 'NO') . PHP_EOL;
assert($cashierCheck === true, 'Cashier1 password must verify');
echo "✓ User accounts and credentials function properly." . PHP_EOL;

echo PHP_EOL . "=== 5. VERIFYING DISPLAY SETTINGS INTEGRITY ===" . PHP_EOL;
$displayConfigResponse = (new \App\Http\Controllers\Api\DisplayConfigurationController())->show();
$configData = $displayConfigResponse->getData();
$settings = $configData->settings;
$windows = $configData->windows;

echo "Display Settings exists: " . ($settings ? 'YES' : 'NO') . PHP_EOL;
echo "Enabled Departments: " . json_encode($settings->enabledDepartments ?? []) . PHP_EOL;
echo "Font Controls Present: " . (isset($settings->fontControls) ? 'YES' : 'NO') . PHP_EOL;
echo "Panel Colors Present: " . (isset($settings->panelColors) ? 'YES' : 'NO') . PHP_EOL;
echo "Display Labels Present: " . (isset($settings->displayLabels) ? 'YES' : 'NO') . PHP_EOL;
echo "Display Windows Count: " . count($windows) . PHP_EOL;

assert(isset($settings->fontControls), 'fontControls must be present');
assert(isset($settings->panelColors), 'panelColors must be present');
assert(isset($settings->displayLabels), 'displayLabels must be present');
assert(count($windows) === 12, '12 display windows must be present');
echo "✓ Display settings, font controls, panel colors, and labels are fully preserved." . PHP_EOL;

echo PHP_EOL . "=== 6. VERIFYING INITIAL TICKET GENERATION AND COUNTER RESET ===" . PHP_EOL;
$queueController = new \App\Http\Controllers\Api\QueueController();

// 1. Generate Cashier Regular
$reqC = \Illuminate\Http\Request::create('/api/queue/generate', 'POST', [
    'service_type' => 'C',
    'priority_type' => 'R',
    'transaction_type' => 'Payment',
]);
$resC = $queueController->generateTicket($reqC);
$ticketC = json_decode($resC->getContent());
$tNumC = $ticketC->ticket->ticket_number ?? '';
$tIdC = $ticketC->ticket->ticket_id ?? 0;
echo "New Cashier Regular Ticket:  Number = {$tNumC}, ID = {$tIdC}" . PHP_EOL;
assert($tNumC === 'C-R001', 'Cashier regular must start at C-R001');
assert((int)$tIdC === 1, 'Cashier regular ticket_id must start at 1');

// 2. Generate Cashier Priority (with security code)
$securityUser = User::where('role', 'security')->first();
$reqCP = \Illuminate\Http\Request::create('/api/queue/generate', 'POST', [
    'service_type' => 'C',
    'priority_type' => 'P',
    'security_code' => $securityUser?->security_code,
    'transaction_type' => 'Payment',
]);
$resCP = $queueController->generateTicket($reqCP);
$ticketCP = json_decode($resCP->getContent());
$tNumCP = $ticketCP->ticket->ticket_number ?? '';
$tIdCP = $ticketCP->ticket->ticket_id ?? 0;
echo "New Cashier Priority Ticket: Number = {$tNumCP}, ID = {$tIdCP}" . PHP_EOL;
assert($tNumCP === 'C-P001', 'Cashier priority must start at C-P001');
assert((int)$tIdCP === 2, 'Cashier priority ticket_id must start at 2');

// 3. Clean up test verification tickets and re-reset counter
DB::table('queue_tickets')->delete();
DB::statement("ALTER TABLE queue_tickets AUTO_INCREMENT = 1;");
echo "Cleaned up verification test tickets and reset AUTO_INCREMENT = 1." . PHP_EOL;
$finalCount = DB::table('queue_tickets')->count();
echo "Final queue_tickets count: {$finalCount}" . PHP_EOL;
assert($finalCount === 0, 'Final tickets count must be 0');

echo PHP_EOL . "ALL VERIFICATIONS PASSED SUCCESSFULLY!" . PHP_EOL;
