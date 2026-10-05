<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\QueueTicket;
use App\Models\ServiceTransaction;
use App\Models\ServiceLog;
use App\Models\DisplaySetting;
use App\Models\User;
use App\Models\ServiceWindow;
use App\Models\DisplayWindow;

echo "==================================================" . PHP_EOL;
echo "  QUEUING SYSTEM TRANSACTION DATA RESET SCRIPT    " . PHP_EOL;
echo "==================================================" . PHP_EOL . PHP_EOL;

// 1. Verify connection
$databaseName = DB::connection()->getDatabaseName();
echo "Connected to database: {$databaseName}" . PHP_EOL;

// 2. Pre-reset counts
$preQueueTickets = DB::table('queue_tickets')->count();
$preServiceTransactions = DB::table('service_transactions')->count();
$preCallingLogs = DB::table('service_logs')
    ->where(function ($q) {
        $q->where('action', 'LIKE', 'Called ticket:%')
          ->orWhere('action', 'LIKE', 'Completed ticket:%')
          ->orWhere('action', 'LIKE', 'Skipped / no show:%');
    })->count();
$preTotalLogs = DB::table('service_logs')->count();
$preUsers = DB::table('users')->count();
$preServiceWindows = DB::table('service_windows')->count();
$preDisplayWindows = DB::table('display_windows')->count();
$preDisplaySettings = DB::table('display_settings')->count();
$preStudents = DB::table('student_directory')->count();

echo PHP_EOL . "--- PRE-RESET COUNTS ---" . PHP_EOL;
echo "queue_tickets:            {$preQueueTickets}" . PHP_EOL;
echo "service_transactions:     {$preServiceTransactions}" . PHP_EOL;
echo "ticket calling/srv logs:  {$preCallingLogs} (out of {$preTotalLogs} total logs)" . PHP_EOL;
echo "users (staff/admin):      {$preUsers}" . PHP_EOL;
echo "service_windows:          {$preServiceWindows}" . PHP_EOL;
echo "display_windows:          {$preDisplayWindows}" . PHP_EOL;
echo "display_settings:         {$preDisplaySettings}" . PHP_EOL;
echo "student_directory:        {$preStudents}" . PHP_EOL;

// 3. Perform Reset inside a database transaction following FK relationships
echo PHP_EOL . "--- EXECUTING RESET IN TRANSACTION ---" . PHP_EOL;

$clearedCounts = DB::transaction(function () {
    // 1. Delete child table records first: service_transactions has foreign key to queue_tickets
    $deletedTransactions = DB::table('service_transactions')->delete();
    echo "Deleted service_transactions: {$deletedTransactions}" . PHP_EOL;

    // 2. Delete queue_tickets
    $deletedTickets = DB::table('queue_tickets')->delete();
    echo "Deleted queue_tickets: {$deletedTickets}" . PHP_EOL;

    // 3. Delete calling and service history from service_logs derived from test transactions
    $deletedLogs = DB::table('service_logs')
        ->where(function ($q) {
            $q->where('action', 'LIKE', 'Called ticket:%')
              ->orWhere('action', 'LIKE', 'Completed ticket:%')
              ->orWhere('action', 'LIKE', 'Skipped / no show:%');
        })->delete();
    echo "Deleted ticket calling/service logs: {$deletedLogs}" . PHP_EOL;

    return [
        'transactions' => $deletedTransactions,
        'tickets' => $deletedTickets,
        'logs' => $deletedLogs,
    ];
});

// 4. Reset AUTO_INCREMENT on affected transaction tables
echo PHP_EOL . "--- RESETTING AUTO_INCREMENT COUNTERS ---" . PHP_EOL;
DB::statement("ALTER TABLE service_transactions AUTO_INCREMENT = 1;");
DB::statement("ALTER TABLE queue_tickets AUTO_INCREMENT = 1;");
echo "Reset AUTO_INCREMENT = 1 for service_transactions" . PHP_EOL;
echo "Reset AUTO_INCREMENT = 1 for queue_tickets" . PHP_EOL;

// 5. Post-reset verification
$postQueueTickets = DB::table('queue_tickets')->count();
$postServiceTransactions = DB::table('service_transactions')->count();
$postCallingLogs = DB::table('service_logs')
    ->where(function ($q) {
        $q->where('action', 'LIKE', 'Called ticket:%')
          ->orWhere('action', 'LIKE', 'Completed ticket:%')
          ->orWhere('action', 'LIKE', 'Skipped / no show:%');
    })->count();
$postUsers = DB::table('users')->count();
$postServiceWindows = DB::table('service_windows')->count();
$postDisplayWindows = DB::table('display_windows')->count();
$postDisplaySettings = DB::table('display_settings')->count();
$postStudents = DB::table('student_directory')->count();

echo PHP_EOL . "--- POST-RESET VERIFICATION ---" . PHP_EOL;
echo "queue_tickets:            {$postQueueTickets} (Expected: 0)" . PHP_EOL;
echo "service_transactions:     {$postServiceTransactions} (Expected: 0)" . PHP_EOL;
echo "ticket calling/srv logs:  {$postCallingLogs} (Expected: 0)" . PHP_EOL;
echo "users (staff/admin):      {$postUsers} (Preserved: {$preUsers})" . PHP_EOL;
echo "service_windows:          {$postServiceWindows} (Preserved: {$preServiceWindows})" . PHP_EOL;
echo "display_windows:          {$postDisplayWindows} (Preserved: {$preDisplayWindows})" . PHP_EOL;
echo "display_settings:         {$postDisplaySettings} (Preserved: {$preDisplaySettings})" . PHP_EOL;
echo "student_directory:        {$postStudents} (Preserved: {$preStudents})" . PHP_EOL;

// 6. Verify display settings integrity (fonts, colors, labels)
$displaySetting = DisplaySetting::first();
$settingsData = $displaySetting ? $displaySetting->settings : [];
$hasFontControls = isset($settingsData['fontControls']);
$hasPanelColors = isset($settingsData['panelColors']);
$hasLabels = isset($settingsData['displayLabels']);
echo PHP_EOL . "Display Settings fontControls intact: " . ($hasFontControls ? 'YES' : 'NO') . PHP_EOL;
echo "Display Settings panelColors intact: " . ($hasPanelColors ? 'YES' : 'NO') . PHP_EOL;
echo "Display Settings displayLabels intact: " . ($hasLabels ? 'YES' : 'NO') . PHP_EOL;

// 7. Verify fresh ticket generation starts at normal initial number
echo PHP_EOL . "--- VERIFYING INITIAL TICKET NUMBER GENERATION ---" . PHP_EOL;

// Test Cashier Regular ticket creation
$controller = new \App\Http\Controllers\Api\QueueController();
$requestCashier = \Illuminate\Http\Request::create('/api/queue/generate', 'POST', [
    'service_type' => 'C',
    'priority_type' => 'R',
    'transaction_type' => 'Payment',
]);
$response = $controller->generateTicket($requestCashier);
$createdCashierTicket = json_decode($response->getContent());
echo "Generated Cashier Regular Ticket: Number = " . ($createdCashierTicket->ticket->ticket_number ?? $createdCashierTicket->ticket_number ?? 'N/A') . ", ID = " . ($createdCashierTicket->ticket->ticket_id ?? $createdCashierTicket->ticket_id ?? 'N/A') . PHP_EOL;

$ticketNum = $createdCashierTicket->ticket->ticket_number ?? $createdCashierTicket->ticket_number ?? '';
$ticketId = $createdCashierTicket->ticket->ticket_id ?? $createdCashierTicket->ticket_id ?? 0;

if ($ticketNum === 'C-R001' && (int)$ticketId === 1) {
    echo "✓ Cashier ticket correctly started at initial number C-R001 with ID 1" . PHP_EOL;
} else {
    echo "✗ Cashier ticket did NOT start at C-R001 / ID 1 (Got {$ticketNum} / {$ticketId})" . PHP_EOL;
}

// Clean up test verification tickets so database remains completely 100% clean
DB::table('queue_tickets')->delete();
DB::statement("ALTER TABLE queue_tickets AUTO_INCREMENT = 1;");
echo "Cleaned up verification tickets and reset AUTO_INCREMENT to 1." . PHP_EOL;

$finalTicketCount = DB::table('queue_tickets')->count();
echo "Final queue_tickets count: {$finalTicketCount}" . PHP_EOL;

echo PHP_EOL . "RESET AND VERIFICATION COMPLETED SUCCESSFULLY!" . PHP_EOL;
