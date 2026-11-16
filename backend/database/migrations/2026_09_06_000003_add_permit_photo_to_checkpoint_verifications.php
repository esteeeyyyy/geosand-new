<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checkpoint_verifications', function (Blueprint $table) {
            $table->string('permit_photo_path')->nullable()->after('remarks');
        });
    }

    public function down(): void
    {
        Schema::table('checkpoint_verifications', function (Blueprint $table) {
            $table->dropColumn('permit_photo_path');
        });
    }
};
