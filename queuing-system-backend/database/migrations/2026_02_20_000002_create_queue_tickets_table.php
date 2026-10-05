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
        Schema::create('queue_tickets', function (Blueprint $table) {
            $table->id('ticket_id');
            $table->string('ticket_number', 50)->unique();
            $table->enum('service_type', ['C', 'R'])->comment('C=Cashier, R=Registrar');
            $table->enum('priority_type', ['R', 'P'])->default('R')->comment('R=Regular, P=Priority');
            $table->enum('status', ['waiting', 'serving', 'done', 'cancelled'])->default('waiting');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('queue_tickets');
    }
};
