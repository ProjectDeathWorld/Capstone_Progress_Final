<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('position', 50)->nullable()->change();
        });
        DB::table('service_windows')->insertOrIgnore([
            'department' => 'Admission', 'window_number' => 1, 'service_type' => 'ADM',
            'service_scope' => 'department', 'is_available' => false, 'status' => 'closed',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        foreach (DB::table('display_settings')->get() as $row) {
            $settings = json_decode($row->settings, true) ?: [];
            $settings['enabledDepartments'] ??= ['Cashier', 'Registrar', ...(!empty($settings['itmMode']) ? ['ITM'] : [])];
            unset($settings['itmMode'], $settings['systemMode']);
            DB::table('display_settings')->where('id', $row->id)->update(['settings' => json_encode($settings)]);
        }
    }

    public function down(): void
    {
        // Retain department values, assignments and historical records.
    }
};
