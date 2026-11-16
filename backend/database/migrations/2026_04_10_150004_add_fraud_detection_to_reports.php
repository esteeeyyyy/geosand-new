<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->float('ml_fraud_score')->nullable()->after('ml_priority_score');
            $table->json('ml_fraud_indicators')->nullable()->after('ml_fraud_score');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['ml_fraud_score', 'ml_fraud_indicators']);
        });
    }
};
