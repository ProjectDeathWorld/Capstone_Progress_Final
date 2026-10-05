<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(ITMStaffSeeder::class);
        $this->call(ITMStaffWindowsSeeder::class);
        $this->call(AdmissionStaffSeeder::class);

        // Admin user (Head Admin)
        User::firstOrCreate(['username' => 'admin'], [
            'password' => 'admin123',
            'full_name' => 'System Administrator',
            'role' => 'admin',
            'position' => null,
            'status' => 'active',
        ]);

        // Department Admins
        User::firstOrCreate(['username' => 'Accounting'], [
            'password' => 'admin123',
            'full_name' => 'Accounting Department Admin',
            'role' => 'dept_admin',
            'position' => 'cashier',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'Registrar'], [
            'password' => 'admin123',
            'full_name' => 'Registrar Department Admin',
            'role' => 'dept_admin',
            'position' => 'registrar',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'ITM'], [
            'password' => 'admin123',
            'full_name' => 'ITM Department Admin',
            'role' => 'dept_admin',
            'position' => 'itm',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'Admission'], [
            'password' => 'admin123',
            'full_name' => 'Admission Department Admin',
            'role' => 'dept_admin',
            'position' => 'admission',
            'status' => 'active',
        ]);

        // Cashier staff (3 accounts)
        User::firstOrCreate(['username' => 'cashier1'], [
            'password' => 'staff123',
            'full_name' => 'Cashier Staff 1',
            'role' => 'staff',
            'position' => 'cashier',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'cashier2'], [
            'password' => 'staff123',
            'full_name' => 'Cashier Staff 2',
            'role' => 'staff',
            'position' => 'cashier',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'cashier3'], [
            'password' => 'staff123',
            'full_name' => 'Cashier Staff 3',
            'role' => 'staff',
            'position' => 'cashier',
            'status' => 'active',
        ]);

        // Registrar staff (6 accounts)
        User::firstOrCreate(['username' => 'registrar1'], [
            'password' => 'staff123',
            'full_name' => 'Registrar Staff 1',
            'role' => 'staff',
            'position' => 'registrar',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'registrar2'], [
            'password' => 'staff123',
            'full_name' => 'Registrar Staff 2',
            'role' => 'staff',
            'position' => 'registrar',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'registrar3'], [
            'password' => 'staff123',
            'full_name' => 'Registrar Staff 3',
            'role' => 'staff',
            'position' => 'registrar',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'registrar4'], [
            'password' => 'staff123',
            'full_name' => 'Registrar Staff 4',
            'role' => 'staff',
            'position' => 'registrar',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'registrar5'], [
            'password' => 'staff123',
            'full_name' => 'Registrar Staff 5',
            'role' => 'staff',
            'position' => 'registrar',
            'status' => 'active',
        ]);

        User::firstOrCreate(['username' => 'registrar6'], [
            'password' => 'staff123',
            'full_name' => 'Registrar Staff 6',
            'role' => 'staff',
            'position' => 'registrar',
            'status' => 'active',
        ]);

        // Security guard (uses security_code PIN at kiosk to authorize priority tickets)
        User::firstOrCreate(['username' => 'security1'], [
            'password' => 'security123',
            'full_name' => 'Security Guard 1',
            'role' => 'security',
            'position' => null,
            'status' => 'active',
            'security_code' => '1234',
        ]);

        User::firstOrCreate(['username' => 'security2'], [
            'password' => 'security123',
            'full_name' => 'Security Guard 2',
            'role' => 'security',
            'position' => null,
            'status' => 'active',
            'security_code' => '5678',
        ]);

        // Default window assignments for Cashier and Registrar
        foreach ([
            ['dept' => 'Cashier', 'num' => 1, 'user' => 'cashier1', 'type' => 'CS'],
            ['dept' => 'Cashier', 'num' => 2, 'user' => 'cashier2', 'type' => 'CS'],
            ['dept' => 'Cashier', 'num' => 3, 'user' => 'cashier3', 'type' => 'CS'],
            ['dept' => 'registrar', 'num' => 9, 'user' => 'registrar1', 'type' => 'RT'],
            ['dept' => 'registrar', 'num' => 10, 'user' => 'registrar2', 'type' => 'RT'],
            ['dept' => 'registrar', 'num' => 11, 'user' => 'registrar3', 'type' => 'RT'],
            ['dept' => 'registrar', 'num' => 12, 'user' => 'registrar4', 'type' => 'RT'],
            ['dept' => 'registrar', 'num' => 13, 'user' => 'registrar5', 'type' => 'RT'],
            ['dept' => 'registrar', 'num' => 14, 'user' => 'registrar6', 'type' => 'RT'],
        ] as $wData) {
            $staff = User::where('username', $wData['user'])->first();
            if ($staff) {
                $window = \App\Models\ServiceWindow::firstOrNew([
                    'department' => $wData['dept'],
                    'window_number' => $wData['num'],
                ]);
                $window->department = $wData['dept'];
                $window->window_number = $wData['num'];
                $window->service_type = $wData['type'];
                if ($window->staff_id === null) {
                    $window->staff_id = $staff->user_id;
                }
                if (!$window->exists) {
                    $window->is_available = true;
                    $window->status = 'open';
                }
                $window->save();
            }
        }
    }
}
