<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "=== DATABASE CONNECTION ===" . PHP_EOL;
echo "Connection: " . config('database.default') . PHP_EOL;
echo "Database: " . DB::connection()->getDatabaseName() . PHP_EOL;

echo PHP_EOL . "=== TABLE ROW COUNTS ===" . PHP_EOL;
$tables = [
    'display_settings',
    'display_windows',
    'personal_access_tokens',
    'queue_tickets',
    'service_logs',
    'service_transactions',
    'service_windows',
    'sessions',
    'student_directory',
    'users',
];

foreach ($tables as $table) {
    if (Schema::hasTable($table)) {
        $count = DB::table($table)->count();
        echo str_pad($table, 25) . ": " . $count . PHP_EOL;
    } else {
        echo str_pad($table, 25) . ": NOT FOUND" . PHP_EOL;
    }
}

echo PHP_EOL . "=== FOREIGN KEYS ===" . PHP_EOL;
$fks = DB::select("
    SELECT 
        TABLE_NAME, 
        COLUMN_NAME, 
        CONSTRAINT_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
", [DB::connection()->getDatabaseName()]);

foreach ($fks as $fk) {
    echo "{$fk->TABLE_NAME}.{$fk->COLUMN_NAME} -> {$fk->REFERENCED_TABLE_NAME}.{$fk->REFERENCED_COLUMN_NAME} ({$fk->CONSTRAINT_NAME})" . PHP_EOL;
}

echo PHP_EOL . "=== AUTO INCREMENT STATUS ===" . PHP_EOL;
$status = DB::select("
    SELECT TABLE_NAME, AUTO_INCREMENT
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = ? AND AUTO_INCREMENT IS NOT NULL
", [DB::connection()->getDatabaseName()]);

foreach ($status as $row) {
    echo str_pad($row->TABLE_NAME, 25) . ": AUTO_INCREMENT = {$row->AUTO_INCREMENT}" . PHP_EOL;
}

echo PHP_EOL . "=== SERVICE LOGS DISTINCT ACTIONS ===" . PHP_EOL;
$actions = DB::table('service_logs')->select('action', DB::raw('count(*) as count'))->groupBy('action')->get();
foreach ($actions as $act) {
    echo "({$act->count}) {$act->action}" . PHP_EOL;
}

echo PHP_EOL . "=== DISPLAY SETTINGS ===" . PHP_EOL;
$setting = DB::table('display_settings')->first();
if ($setting) {
    echo "ID: {$setting->id}, Published by: {$setting->published_by}, Updated at: {$setting->updated_at}" . PHP_EOL;
    echo "Settings: " . $setting->settings . PHP_EOL;
} else {
    echo "None found." . PHP_EOL;
}

echo PHP_EOL . "=== USERS LIST ===" . PHP_EOL;
$users = DB::table('users')->select('user_id', 'username', 'role', 'position', 'full_name')->get();
foreach ($users as $u) {
    echo "ID: {$u->user_id}, Username: {$u->username}, Role: {$u->role}, Position: {$u->position}, Name: {$u->full_name}" . PHP_EOL;
}


