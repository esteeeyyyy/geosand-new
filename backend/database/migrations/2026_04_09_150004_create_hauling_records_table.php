<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hauling_records', function (Blueprint $table) {
            $table->id();
            $table->string('tracking_code')->unique();
            $table->foreignId('quarry_id')->constrained('quarries')->onDelete('cascade');
            $table->foreignId('operator_id')->constrained('users')->onDelete('cascade');
            $table->string('truck_plate_number');
            $table->decimal('volume_cubic_meters', 10, 2);
            $table->string('material_type')->default('sand');
            $table->string('destination');
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->timestamp('hauled_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hauling_records');
    }
};
