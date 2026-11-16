<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['admin', 'checkpoint_officer', 'quarry_operator', 'quarry_staff'])->default('quarry_operator')->after('password');
            $table->string('phone')->nullable()->after('role');
            $table->string('avatar')->nullable()->after('phone');
            $table->string('google_id')->nullable()->unique()->after('avatar');
            $table->boolean('is_active')->default(true)->after('google_id');
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'phone', 'avatar', 'google_id', 'is_active']);
        });
    }
};
