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
        Schema::create('service_windows', function (Blueprint $table) {
            $table->id();
            $table->string('department'); // Cashier or Registrar
            $table->integer('window_number'); // 1..6
            $table->string('service_type'); // CS or RT
            $table->boolean('is_available')->default(true);
            $table->string('disabled_reason')->nullable();
            $table->timestamps();

            $table->unique(['department', 'window_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_windows');
    }
};
