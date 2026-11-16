<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quarry_monitoring_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quarry_id')->constrained('quarries')->cascadeOnDelete();
            $table->date('inspection_date');
            $table->decimal('excavation_depth_m', 8, 2)->nullable();
            $table->decimal('river_setback_m', 8, 2)->nullable();
            $table->decimal('air_quality_pm25', 8, 2)->nullable();
            $table->decimal('water_turbidity_ntu', 8, 2)->nullable();
            $table->decimal('noise_level_db', 8, 2)->nullable();
            $table->decimal('rehabilitated_area_ha', 10, 2)->nullable();
            $table->enum('flood_risk', ['low', 'moderate', 'high'])->nullable();
            $table->enum('compliance_status', ['compliant', 'watch', 'violation'])->default('compliant');
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['quarry_id', 'inspection_date']);
            $table->index('compliance_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quarry_monitoring_records');
    }
};
