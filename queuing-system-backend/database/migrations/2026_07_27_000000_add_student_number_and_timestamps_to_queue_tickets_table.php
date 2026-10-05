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
        Schema::table('queue_tickets', function (Blueprint $table) {
            if (!Schema::hasColumn('queue_tickets', 'student_number')) {
                $table->string('student_number', 100)->nullable()->after('service_type');
            }

            if (!Schema::hasColumn('queue_tickets', 'called_at')) {
                $table->timestamp('called_at')->nullable()->after('status');
            }

            if (!Schema::hasColumn('queue_tickets', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('called_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            if (Schema::hasColumn('queue_tickets', 'completed_at')) {
                $table->dropColumn('completed_at');
            }
            if (Schema::hasColumn('queue_tickets', 'called_at')) {
                $table->dropColumn('called_at');
            }
            if (Schema::hasColumn('queue_tickets', 'student_number')) {
                $table->dropColumn('student_number');
            }
        });
    }
};
