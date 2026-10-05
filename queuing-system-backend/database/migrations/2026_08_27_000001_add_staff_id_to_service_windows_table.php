<?php

use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_windows', function (Blueprint $table) {
            if (!Schema::hasColumn('service_windows', 'staff_id')) {
                $table->unsignedBigInteger('staff_id')->nullable()->after('window_number');
            }
        });

        try {
            DB::statement('ALTER TABLE service_windows ADD UNIQUE INDEX service_windows_staff_id_unique (staff_id)');
        } catch (\Throwable $exception) {
            // Ignore duplicate index errors during repeated migration runs.
        }

        try {
            DB::statement('ALTER TABLE service_windows ADD CONSTRAINT service_windows_staff_id_foreign FOREIGN KEY (staff_id) REFERENCES users (user_id)');
        } catch (\Throwable $exception) {
            // Ignore duplicate constraint errors during repeated migration runs.
        }

        $registrarMap = [
            9 => 'registrar1',
            10 => 'registrar2',
            11 => 'registrar3',
            12 => 'registrar4',
            13 => 'registrar5',
        ];

        foreach ($registrarMap as $windowNumber => $username) {
            $staff = User::where('username', $username)
                ->where('role', 'staff')
                ->where('position', 'registrar')
                ->where('status', 'active')
                ->first();

            if (!$staff) {
                continue;
            }

            $window = ServiceWindow::whereRaw('LOWER(department) = ?', ['registrar'])
                ->where('window_number', $windowNumber)
                ->first();

            if (!$window) {
                $window = ServiceWindow::whereRaw('LOWER(department) = ?', ['registrar'])
                    ->whereIn('window_number', [1, 2, 3, 4, 5, 6])
                    ->orderBy('window_number')
                    ->first();
            }

            if ($window) {
                $window->department = 'registrar';
                $window->window_number = $windowNumber;
                $window->service_type = 'RT';
                $window->staff_id = $staff->user_id;
                $window->is_available = true;
                $window->status = 'open';
                $window->disabled_reason = null;
                $window->save();
            } else {
                ServiceWindow::create([
                    'department' => 'registrar',
                    'window_number' => $windowNumber,
                    'service_type' => 'RT',
                    'is_available' => true,
                    'status' => 'open',
                    'staff_id' => $staff->user_id,
                    'disabled_reason' => null,
                ]);
            }
        }

        ServiceWindow::whereRaw('LOWER(department) = ?', ['registrar'])
            ->whereNotIn('window_number', [9, 10, 11, 12, 13])
            ->delete();

        ServiceWindow::whereRaw('LOWER(department) = ?', ['registrar'])
            ->update(['department' => 'registrar']);
    }

    public function down(): void
    {
        try {
            DB::statement('ALTER TABLE service_windows DROP FOREIGN KEY service_windows_staff_id_foreign');
        } catch (\Throwable $exception) {
            // Ignore missing foreign key during rollback.
        }

        try {
            DB::statement('ALTER TABLE service_windows DROP INDEX service_windows_staff_id_unique');
        } catch (\Throwable $exception) {
            // Ignore missing index during rollback.
        }

        Schema::table('service_windows', function (Blueprint $table) {
            $table->dropColumn('staff_id');
        });
    }
};
