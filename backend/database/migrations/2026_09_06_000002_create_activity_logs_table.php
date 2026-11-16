<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('user_name')->nullable();   // snapshot in case user is deleted
            $table->string('user_role')->nullable();
            $table->string('action');                  // e.g. "created", "updated", "deleted", "login"
            $table->string('module');                  // e.g. "Quarry", "User", "HaulingRecord"
            $table->string('subject')->nullable();     // human-readable target e.g. "Bongabong River Quarry"
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('changes')->nullable();       // before/after diff for updates
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
