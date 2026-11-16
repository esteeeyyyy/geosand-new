<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quarries', function (Blueprint $table) {
            $table->decimal('annual_allowable_volume_cubic_meters', 12, 2)
                ->nullable()
                ->after('area_hectares');
        });
    }

    public function down(): void
    {
        Schema::table('quarries', function (Blueprint $table) {
            $table->dropColumn('annual_allowable_volume_cubic_meters');
        });
    }
};
