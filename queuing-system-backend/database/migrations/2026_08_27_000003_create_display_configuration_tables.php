<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('display_settings', function (Blueprint $table) {
            $table->id();
            $table->longText('settings');
            $table->foreignId('published_by')->nullable()->constrained('users', 'user_id')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('display_windows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_window_id')->nullable()->constrained('service_windows')->nullOnDelete();
            $table->unsignedInteger('window_number');
            $table->string('display_name');
            $table->string('department', 40);
            $table->string('display_color', 20)->default('#2563eb');
            $table->boolean('is_visible')->default(true);
            $table->unsignedInteger('sort_order');
            $table->timestamps();
            $table->unique(['department', 'window_number']);
            $table->unique('sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('display_windows');
        Schema::dropIfExists('display_settings');
    }
};
