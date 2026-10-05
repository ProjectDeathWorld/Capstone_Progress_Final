<?php

namespace Database\Seeders;

use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ITMStaffSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::where('username', 'itm')->first();
        $created = $user === null;

        if ($created) {
            $user = new User(['username' => 'itm']);
        }

        $user->full_name = 'ITM Staff 1';
        $user->role = 'staff';
        $user->position = 'itm';
        $user->status = 'active';
        if ($created) {
            $user->password = Str::random(64);
        }

        $user->save();

        if (Schema::hasTable('service_windows') && Schema::hasColumn('service_windows', 'service_scope')) {
            $window = ServiceWindow::firstOrCreate(
                ['department' => 'ITM', 'window_number' => 1],
                ['service_type' => 'ITM', 'is_available' => true, 'status' => 'open']
            );

            if ($window->staff_id === null || (int) $window->staff_id === (int) $user->user_id) {
                $window->update([
                    'staff_id' => $user->user_id,
                    'service_scope' => 'department',
                    'is_available' => true,
                    'status' => 'open',
                    'disabled_reason' => null,
                ]);
            } else {
                $this->command?->warn('ITM account repaired, but ITM Window 1 is already assigned.');
            }
        } else {
            $this->command?->warn('ITM account repaired. Run migrations before assigning its ITM window.');
        }

        $this->command?->info($created
            ? 'Created active ITM Staff 1 account. Set its password through Staff Management before first login.'
            : 'Verified and repaired existing ITM Staff 1 account without changing its password.');
    }
}
