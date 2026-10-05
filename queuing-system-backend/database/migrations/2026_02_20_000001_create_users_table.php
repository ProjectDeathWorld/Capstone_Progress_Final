<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('username', 50)->unique();
            $table->string('password');
            $table->string('full_name', 100);
            $table->enum('role', ['admin', 'dept_admin', 'staff', 'security'])->default('staff');
            $table->enum('position', ['cashier', 'registrar'])->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->string('security_code', 20)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
