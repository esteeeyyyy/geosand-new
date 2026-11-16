<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the old pivot table
        Schema::dropIfExists('quarry_operator');

        // Add quarry_id to users (for operators and staff)
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('quarry_id')->nullable()->after('role')->constrained()->nullOnDelete();
        });

        // Update role enum to include quarry_staff
        // (Laravel doesn't easily change enums, so we use string and validate in app)
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('quarry_id');
        });

        Schema::create('quarry_operator', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quarry_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            $table->unique(['quarry_id', 'user_id']);
        });
    }
};
