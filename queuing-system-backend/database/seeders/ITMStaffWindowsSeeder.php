<?php

namespace Database\Seeders;

use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;

class ITMStaffWindowsSeeder extends Seeder
{
    public function run(): void
    {
        if (!Schema::hasTable('service_windows') || !Schema::hasColumn('service_windows', 'service_scope')) {
            throw new RuntimeException('Run the database migrations before provisioning ITM Windows 2 and 3.');
        }

        foreach ([2, 3] as $windowNumber) {
            DB::transaction(function () use ($windowNumber) {
                $username = 'itm'.$windowNumber;
                $user = User::query()->firstOrNew(['username' => $username]);
                $created = !$user->exists;

                $user->full_name = 'ITM Staff '.$windowNumber;
                $user->role = 'staff';
                $user->position = 'itm';
                $user->status = 'active';
                if ($created) {
                    $user->password = Str::random(64);
                }
                $user->save();

                $window = ServiceWindow::query()
                    ->whereRaw('LOWER(department) = ?', ['itm'])
                    ->where('window_number', $windowNumber)
                    ->lockForUpdate()
                    ->first();

                if (!$window) {
                    $window = ServiceWindow::create([
                        'department' => 'ITM',
                        'window_number' => $windowNumber,
                        'service_type' => 'ITM',
                        'service_scope' => 'department',
                        'staff_id' => $user->user_id,
                        'is_available' => true,
                        'status' => 'open',
                    ]);
                } else {
                    if ($window->staff_id !== null && (int) $window->staff_id !== (int) $user->user_id) {
                        throw new RuntimeException("ITM Window {$windowNumber} is already assigned to another staff account.");
                    }

                    $window->update([
                        'service_type' => 'ITM',
                        'service_scope' => 'department',
                        'staff_id' => $user->user_id,
                    ]);
                }

                ServiceWindow::query()
                    ->where('staff_id', $user->user_id)
                    ->where('id', '<>', $window->id)
                    ->update(['staff_id' => null, 'service_scope' => 'department']);
            });
        }

        $this->command?->info('Verified ITM Staff 2 / Window 2 and ITM Staff 3 / Window 3 assignments. Set their passwords through Staff Management before first login.');
    }
}
