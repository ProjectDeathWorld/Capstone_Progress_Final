<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            // This obsolete window is no longer part of the cashier configuration.
            DB::table('service_windows')
                ->whereRaw('LOWER(department) = ?', ['cashier'])
                ->where('window_number', 5)
                ->whereNull('staff_id')
                ->delete();

            foreach ([1, 2, 3] as $number) {
                $staffId = DB::table('users')->where('username', 'cashier'.$number)
                    ->where('role', 'staff')->where('position', 'cashier')
                    ->value('user_id');

                // Preserve explicit assignments, including later administrator changes.
                if (!$staffId || DB::table('service_windows')->where('staff_id', $staffId)->exists()) {
                    continue;
                }

                DB::table('service_windows')
                    ->whereRaw('LOWER(department) = ?', ['cashier'])
                    ->where('window_number', $number)->whereNull('staff_id')
                    ->update(['staff_id' => $staffId, 'updated_at' => now()]);
            }
        });
    }

    public function down(): void
    {
        // Preserve repaired assignments and any subsequent administrator changes.
    }
};
