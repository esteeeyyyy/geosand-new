<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quarry_permits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quarry_id')->constrained('quarries')->cascadeOnDelete();
            $table->string('permit_number', 100);
            $table->date('issued_at');
            $table->date('expires_at');
            $table->decimal('annual_allowable_volume_cubic_meters', 12, 2)->nullable();
            $table->string('status', 20)->default('active');
            $table->string('document_path')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['quarry_id', 'issued_at', 'expires_at'], 'quarry_permits_term_index');
        });

        Schema::table('hauling_records', function (Blueprint $table) {
            $table->foreignId('permit_id')
                ->nullable()
                ->after('quarry_id')
                ->constrained('quarry_permits')
                ->nullOnDelete();
        });

        $now = now();
        DB::table('quarries')
            ->whereNotNull('permit_number')
            ->whereNotNull('permit_issued_at')
            ->whereNotNull('permit_expires_at')
            ->orderBy('id')
            ->each(function (object $quarry) use ($now): void {
                $permitId = DB::table('quarry_permits')->insertGetId([
                    'quarry_id' => $quarry->id,
                    'permit_number' => $quarry->permit_number,
                    'issued_at' => $quarry->permit_issued_at,
                    'expires_at' => $quarry->permit_expires_at,
                    'annual_allowable_volume_cubic_meters' => $quarry->annual_allowable_volume_cubic_meters,
                    'status' => 'active',
                    'created_by' => $quarry->created_by,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                DB::table('hauling_records')
                    ->where('quarry_id', $quarry->id)
                    ->whereDate('hauled_at', '>=', $quarry->permit_issued_at)
                    ->whereDate('hauled_at', '<=', $quarry->permit_expires_at)
                    ->update(['permit_id' => $permitId]);
            });
    }

    public function down(): void
    {
        Schema::table('hauling_records', function (Blueprint $table) {
            $table->dropConstrainedForeignId('permit_id');
        });

        Schema::dropIfExists('quarry_permits');
    }
};
