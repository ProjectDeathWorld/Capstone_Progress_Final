<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN position VARCHAR(50) NULL");
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->string('position', 50)->nullable()->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN position ENUM('cashier', 'registrar') NULL");
        } else {
            Schema::table('users', function (Blueprint $table) {
                $table->enum('position', ['cashier', 'registrar'])->nullable()->change();
            });
        }
    }
};
