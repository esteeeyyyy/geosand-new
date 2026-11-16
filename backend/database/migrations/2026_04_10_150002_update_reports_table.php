<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->string('reporter_email')->nullable()->change();
            $table->string('address')->after('message');
            $table->string('image_path')->nullable()->after('address');
            $table->string('ml_category')->nullable()->after('image_path');
            $table->float('ml_priority_score')->nullable()->after('ml_category');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->string('reporter_email')->nullable(false)->change();
            $table->dropColumn(['address', 'image_path', 'ml_category', 'ml_priority_score']);
        });
    }
};
