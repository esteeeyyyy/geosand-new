<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quarries', function (Blueprint $table) {
            $table->date('permit_expires_at')->nullable()->after('permit_number');
        });
    }

    public function down(): void
    {
        Schema::table('quarries', function (Blueprint $table) {
            $table->dropColumn('permit_expires_at');
        });
    }
};
