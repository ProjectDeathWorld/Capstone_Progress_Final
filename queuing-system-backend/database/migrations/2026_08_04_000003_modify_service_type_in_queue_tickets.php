<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Only run on MySQL; SQLite does not support MODIFY
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE queue_tickets MODIFY COLUMN service_type VARCHAR(50) NOT NULL");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE queue_tickets MODIFY COLUMN service_type VARCHAR(10) NOT NULL");
        }
    }
};
