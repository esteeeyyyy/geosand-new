<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hauling_record_id')->constrained('hauling_records')->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('accuracy_m', 8, 2)->nullable();
            $table->decimal('speed_kph', 8, 2)->nullable();
            $table->decimal('heading_degrees', 6, 2)->nullable();
            $table->timestamp('captured_at');
            $table->timestamps();

            $table->index(['hauling_record_id', 'captured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_locations');
    }
};
