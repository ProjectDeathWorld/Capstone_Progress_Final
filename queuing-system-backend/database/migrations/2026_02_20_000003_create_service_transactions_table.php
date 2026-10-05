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
        Schema::create('service_transactions', function (Blueprint $table) {
            $table->id('transaction_id');
            $table->unsignedBigInteger('ticket_id');
            $table->unsignedBigInteger('staff_id');
            $table->timestamp('start_time')->nullable();
            $table->timestamp('end_time')->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->enum('performance_rating', ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'])->nullable();
            $table->text('remarks')->nullable();

            $table->foreign('ticket_id')->references('ticket_id')->on('queue_tickets')->onDelete('cascade');
            $table->foreign('staff_id')->references('user_id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_transactions');
    }
};
