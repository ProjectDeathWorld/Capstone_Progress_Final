<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Reuse the existing directory rather than creating a competing
        // student table on fresh installations.
        if (!Schema::hasTable('student_directory')) {
            Schema::create('student_directory', function (Blueprint $table) {
                $table->id();
                $table->string('student_number', 30)->unique();
                $table->string('student_name', 150);
                $table->string('course', 200);
                $table->unsignedTinyInteger('registrar_window')->nullable();
                $table->string('routing_status')->default('Active');
                $table->timestamps();
            });
        }

        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->string('student_name', 150)->nullable()->after('student_number');
            $table->string('course', 200)->nullable()->after('student_name');
        });
    }

    public function down(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->dropColumn(['student_name', 'course']);
        });
        Schema::dropIfExists('student_directory');
    }
};
