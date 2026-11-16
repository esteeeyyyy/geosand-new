<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quarries', function (Blueprint $table) {
            $table->date('permit_issued_at')->nullable()->after('permit_number');
        });

        DB::table('quarries')
            ->whereNotNull('permit_expires_at')
            ->orderBy('id')
            ->each(function (object $quarry): void {
                DB::table('quarries')
                    ->where('id', $quarry->id)
                    ->update([
                        'permit_issued_at' => Carbon::parse($quarry->permit_expires_at)
                            ->subYearNoOverflow()
                            ->toDateString(),
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('quarries', function (Blueprint $table) {
            $table->dropColumn('permit_issued_at');
        });
    }
};
