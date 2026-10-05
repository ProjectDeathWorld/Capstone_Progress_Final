<?php

namespace Database\Seeders;

use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class AdmissionStaffSeeder extends Seeder
{
    private const PASSWORD = 'admission123';

    public function run(): void
    {
        $username = 'admission1';
        $user = User::where('username', $username)->first();
        $created = $user === null;

        if ($created) {
            $user = new User(['username' => $username]);
        }

        $user->full_name = 'Admission Staff 1';
        $user->role = 'staff';
        $user->position = 'admission';
        $user->status = 'active';

        $passwordMatches = false;
        if (!$created) {
            try {
                $passwordMatches = Hash::check(self::PASSWORD, (string) $user->getRawOriginal('password'));
            } catch (\Throwable) {
                $passwordMatches = false;
            }
        }

        if (!$passwordMatches) {
            $user->password = self::PASSWORD;
        }

        $user->save();

        if (!Schema::hasTable('service_windows') || !Schema::hasColumn('service_windows', 'service_scope')) {
            $this->command?->warn('Admission account saved. Run migrations before assigning Admission Window 1.');
            return;
        }

        $window = ServiceWindow::firstOrCreate(
            ['department' => 'Admission', 'window_number' => 1],
            ['service_type' => 'ADM', 'is_available' => false, 'status' => 'closed']
        );

        if ($window->staff_id !== null && (int) $window->staff_id !== (int) $user->user_id) {
            $this->command?->warn('Admission account saved, but Admission Window 1 is assigned to another staff member.');
            return;
        }

        ServiceWindow::where('staff_id', $user->user_id)
            ->where('id', '<>', $window->id)
            ->update(['staff_id' => null, 'service_scope' => 'department']);

        $window->update([
            'service_type' => 'ADM',
            'staff_id' => $user->user_id,
            'service_scope' => 'department',
            'is_available' => true,
            'status' => 'open',
            'disabled_reason' => null,
        ]);

        $this->command?->info($created ? 'Created active Admission staff account and assigned Admission Window 1.' : 'Verified and repaired Admission staff account and Window 1 assignment.');
    }
}
