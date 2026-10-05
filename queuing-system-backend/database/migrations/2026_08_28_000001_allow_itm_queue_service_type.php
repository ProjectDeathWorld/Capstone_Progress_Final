<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('queue_tickets', function (Blueprint $table) {
            $table->string('service_type', 50)->change();
        });
    }

    public function down(): void
    {
        // Keep this rollback non-destructive: existing ITM tickets cannot be
        // represented by the original C/R-only enum.
    }
};
