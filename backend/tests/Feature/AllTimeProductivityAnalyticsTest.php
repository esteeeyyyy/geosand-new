<?php

namespace Tests\Feature;

use App\Models\HaulingRecord;
use App\Models\Quarry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AllTimeProductivityAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_productivity_uses_all_time_history_when_report_period_changes(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-14 12:00:00', 'UTC'));
        $this->registerSqliteDateFormatFunction();

        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $operator = User::factory()->create(['role' => 'quarry_operator', 'is_active' => true]);
        $quarry = Quarry::create([
            'name' => 'Productivity Test Quarry',
            'latitude' => 12.7167,
            'longitude' => 121.3667,
            'status' => 'active',
            'created_by' => $admin->id,
        ]);

        $this->createRecord($quarry, $operator, 90, '2026-09-15 08:00:00');
        $this->createRecord($quarry, $operator, 120, '2026-10-15 08:00:00');
        $this->createRecord($quarry, $operator, 150, '2026-11-14 08:00:00');

        Sanctum::actingAs($admin);

        $allTime = $this->getJson('/api/v1/admin/analytics?period=all')->assertOk();
        $daily = $this->getJson('/api/v1/admin/analytics?period=day')->assertOk();

        $allTime->assertJsonCount(3, 'productivity_history');
        $daily
            ->assertJsonCount(1, 'trend_hauling')
            ->assertJsonCount(3, 'productivity_history')
            ->assertJsonPath('predictive_analysis.data_scope', 'all_time')
            ->assertJsonPath('predictive_analysis.model_info.periods_evaluated', 3);

        $this->assertSame(
            $allTime->json('predictive_analysis.classification'),
            $daily->json('predictive_analysis.classification'),
        );
        $this->assertSame(
            $allTime->json('predictive_analysis.monthly_growth_rate_pct'),
            $daily->json('predictive_analysis.monthly_growth_rate_pct'),
        );
    }

    private function createRecord(Quarry $quarry, User $operator, float $volume, string $hauledAt): void
    {
        HaulingRecord::create([
            'quarry_id' => $quarry->id,
            'operator_id' => $operator->id,
            'truck_plate_number' => 'ABC-1234',
            'volume_cubic_meters' => $volume,
            'material_type' => 'sand',
            'destination' => 'Bongabong',
            'status' => 'verified',
            'hauled_at' => $hauledAt,
        ]);
    }

    private function registerSqliteDateFormatFunction(): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') return;

        DB::connection()->getPdo()->sqliteCreateFunction('DATE_FORMAT', function ($date, $format) {
            $phpFormat = str_replace(
                ['%Y', '%m', '%d', '%H'],
                ['Y', 'm', 'd', 'H'],
                $format,
            );

            return Carbon::parse($date)->format($phpFormat);
        }, 2);
    }
}
