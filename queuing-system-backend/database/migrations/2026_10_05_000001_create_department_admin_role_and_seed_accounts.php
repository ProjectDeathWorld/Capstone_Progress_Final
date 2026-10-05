<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'staff'");
            DB::statement("ALTER TABLE users MODIFY COLUMN username VARCHAR(50) COLLATE utf8mb4_bin NOT NULL");
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role', 50)->default('staff')->change();
            });
        }

        // Ensure ITM Staff 1 account exists as staff
        $itmStaff = User::where('username', 'itm')->first();
        if ($itmStaff) {
            $itmStaff->update([
                'full_name' => 'ITM Staff 1',
                'role' => 'staff',
                'position' => 'itm',
            ]);
        }

        $accounts = [
            [
                'username' => 'Accounting',
                'password' => 'admin123',
                'full_name' => 'Accounting Department Admin',
                'role' => 'dept_admin',
                'position' => 'cashier',
                'status' => 'active',
            ],
            [
                'username' => 'Registrar',
                'password' => 'admin123',
                'full_name' => 'Registrar Department Admin',
                'role' => 'dept_admin',
                'position' => 'registrar',
                'status' => 'active',
            ],
            [
                'username' => 'ITM',
                'password' => 'admin123',
                'full_name' => 'ITM Department Admin',
                'role' => 'dept_admin',
                'position' => 'itm',
                'status' => 'active',
            ],
            [
                'username' => 'Admission',
                'password' => 'admin123',
                'full_name' => 'Admission Department Admin',
                'role' => 'dept_admin',
                'position' => 'admission',
                'status' => 'active',
            ],
        ];

        foreach ($accounts as $account) {
            $existing = User::where('username', $account['username'])->first();
            if ($existing) {
                $existing->update([
                    'role' => $account['role'],
                    'position' => $account['position'],
                    'password' => $account['password'],
                    'status' => $account['status'],
                    'full_name' => $account['full_name'],
                ]);
            } else {
                User::create([
                    'username' => $account['username'],
                    'password' => $account['password'],
                    'full_name' => $account['full_name'],
                    'role' => $account['role'],
                    'position' => $account['position'],
                    'status' => $account['status'],
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        User::whereIn('username', ['Accounting', 'Registrar', 'ITM', 'Admission'])->delete();

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'staff', 'security') NOT NULL DEFAULT 'staff'");
        }
    }
};
