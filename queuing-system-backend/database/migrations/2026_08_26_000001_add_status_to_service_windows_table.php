<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_windows', function (Blueprint $table) {
            $table->string('status', 10)->default('open')->after('is_available');
        });

        DB::table('service_windows')->where('is_available', false)->update(['status' => 'closed']);
    }

    public function down(): void
    {
        Schema::table('service_windows', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
