<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->index(
                ['service_type', 'status', 'priority_type', 'created_at'],
                'queue_tickets_staff_call_index'
            );
            $table->index(
                ['service_type', 'status', 'window', 'priority_type', 'created_at'],
                'queue_tickets_staff_window_call_index'
            );
        });

        Schema::table('service_transactions', function (Blueprint $table) {
            $table->index(
                ['ticket_id', 'end_time'],
                'service_transactions_active_ticket_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->dropIndex('queue_tickets_staff_call_index');
            $table->dropIndex('queue_tickets_staff_window_call_index');
        });

        Schema::table('service_transactions', function (Blueprint $table) {
            $table->dropIndex('service_transactions_active_ticket_index');
        });
    }
};
