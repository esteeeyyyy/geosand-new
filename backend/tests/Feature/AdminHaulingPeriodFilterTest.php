<?php

namespace Tests\Feature;

use App\Models\HaulingRecord;
use App\Models\Quarry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminHaulingPeriodFilterTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_admin_can_view_ten_daily_records_for_one_quarry_at_a_time(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-14 12:00:00', 'Asia/Manila'));

        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $operator = User::factory()->create(['role' => 'quarry_operator', 'is_active' => true]);
        $firstQuarry = $this->createQuarry($admin, 'First Quarry');
        $secondQuarry = $this->createQuarry($admin, 'Second Quarry');

        foreach (range(1, 12) as $index) {
            $this->createHaulingRecord(
                $firstQuarry,
                $operator,
                CarbonImmutable::parse("2026-11-14 08:{$index}:00", 'Asia/Manila')->utc(),
            );
        }

        $this->createHaulingRecord(
            $firstQuarry,
            $operator,
            CarbonImmutable::parse('2026-11-13 23:59:00', 'Asia/Manila')->utc(),
        );
        $this->createHaulingRecord(
            $secondQuarry,
            $operator,
            CarbonImmutable::parse('2026-11-14 09:00:00', 'Asia/Manila')->utc(),
        );

        Sanctum::actingAs($admin);

        $this->getJson("/api/v1/admin/hauling-records?period=day&quarry_id={$firstQuarry->id}")
            ->assertOk()
            ->assertJsonCount(10, 'hauling_records')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.total', 12)
            ->assertJsonPath('summary.total_records', 12)
            ->assertJsonPath('summary.total_volume_cubic_meters', 120);
    }

    private function createQuarry(User $admin, string $name): Quarry
    {
        return Quarry::create([
            'name' => $name,
            'latitude' => 12.7167,
            'longitude' => 121.3667,
            'status' => 'active',
            'created_by' => $admin->id,
        ]);
    }

    private function createHaulingRecord(Quarry $quarry, User $operator, CarbonImmutable $hauledAt): HaulingRecord
    {
        return HaulingRecord::create([
            'quarry_id' => $quarry->id,
            'operator_id' => $operator->id,
            'truck_plate_number' => 'ABC-1234',
            'volume_cubic_meters' => 10,
            'material_type' => 'sand',
            'destination' => 'Bongabong',
            'status' => 'verified',
            'hauled_at' => $hauledAt,
        ]);
    }
}
