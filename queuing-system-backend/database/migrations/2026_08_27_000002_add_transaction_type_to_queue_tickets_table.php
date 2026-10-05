<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->string('transaction_type', 50)->nullable()->after('service_type');
            $table->index(
                ['service_type', 'status', 'transaction_type', 'completed_at'],
                'queue_tickets_transaction_analytics_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->dropIndex('queue_tickets_transaction_analytics_index');
            $table->dropColumn('transaction_type');
        });
    }
};
