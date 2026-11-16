<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checkpoint_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hauling_record_id')->constrained('hauling_records')->onDelete('cascade');
            $table->foreignId('checkpoint_id')->constrained('checkpoints')->onDelete('cascade');
            $table->foreignId('officer_id')->constrained('users')->onDelete('cascade');
            $table->enum('status', ['verified', 'rejected']);
            $table->text('remarks')->nullable();
            $table->timestamp('verified_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checkpoint_verifications');
    }
};
