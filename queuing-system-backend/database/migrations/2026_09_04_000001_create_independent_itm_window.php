<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $itmStaffIds = DB::table('users')
            ->whereRaw('LOWER(position) = ?', ['itm'])
            ->pluck('user_id');

        DB::table('service_windows')
            ->whereIn('staff_id', $itmStaffIds)
            ->update(['staff_id' => null, 'service_scope' => 'department']);

        $windowId = DB::table('service_windows')
            ->whereRaw('LOWER(department) = ?', ['itm'])
            ->where('window_number', 1)
            ->value('id');

        if (!$windowId) {
            $windowId = DB::table('service_windows')->insertGetId([
                'department' => 'ITM',
                'window_number' => 1,
                'service_type' => 'ITM',
                'service_scope' => 'department',
                'is_available' => true,
                'status' => 'open',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $primaryItmStaffId = $itmStaffIds->first();
        if ($primaryItmStaffId) {
            DB::table('service_windows')->where('id', $windowId)->update([
                'department' => 'ITM',
                'service_type' => 'ITM',
                'service_scope' => 'department',
                'staff_id' => $primaryItmStaffId,
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Keep the ITM window and assignments intact on rollback to avoid data loss.
    }
};
