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
            $table->string('service_scope', 20)->default('department')->after('service_type');
        });

        DB::table('service_windows')->whereRaw('LOWER(department) = ?', ['itm'])->delete();
    }

    public function down(): void
    {
        Schema::table('service_windows', function (Blueprint $table) {
            $table->dropColumn('service_scope');
        });
    }
};
