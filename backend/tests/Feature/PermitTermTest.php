<?php

namespace Tests\Feature;

use App\Models\HaulingRecord;
use App\Models\Quarry;
use App\Models\QuarryPermit;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PermitTermTest extends TestCase
{
    use RefreshDatabase;

    public function test_expiry_is_always_derived_as_one_year_after_issue_date(): void
    {
        $quarry = $this->createQuarry();
        $permit = $this->createPermit($quarry, '2026-11-23');

        $this->assertSame('2027-11-23', $permit->expires_at->toDateString());
    }

    public function test_annual_consumption_only_includes_verified_volume_inside_permit_term(): void
    {
        $operator = User::factory()->create();
        $quarry = $this->createQuarry();
        $permit = $this->createPermit($quarry, '2026-11-23', 100);

        $this->createHaul($quarry, $operator, null, '2026-11-22 12:00:00', 20, 'verified');
        $this->createHaul($quarry, $operator, $permit, '2026-11-23 12:00:00', 30, 'verified');
        $this->createHaul($quarry, $operator, $permit, '2027-11-23 23:59:59', 40, 'verified');
        $this->createHaul($quarry, $operator, null, '2027-11-24 00:00:00', 50, 'verified');
        $this->createHaul($quarry, $operator, $permit, '2027-01-01 12:00:00', 10, 'rejected');
        $this->createHaul($quarry, $operator, $permit, '2027-01-02 12:00:00', 5, 'pending');

        $quarry->loadPermitTermUsage();

        $this->assertSame(70.0, $quarry->permit_term_consumed_volume_cubic_meters);
        $this->assertSame(75.0, $quarry->permit_term_committed_volume_cubic_meters);
        $this->assertSame(25.0, $quarry->permit_term_remaining_volume_cubic_meters);
    }

    public function test_renewal_keeps_each_terms_consumption_separate(): void
    {
        $operator = User::factory()->create();
        $quarry = $this->createQuarry();
        $firstPermit = $this->createPermit($quarry, '2025-11-23', 100);
        $renewal = $this->createPermit($quarry, '2026-11-24', 200, 'QP-2026-002');

        $this->createHaul($quarry, $operator, $firstPermit, '2026-01-10 12:00:00', 30, 'verified');
        $this->createHaul($quarry, $operator, $renewal, '2027-01-10 12:00:00', 80, 'verified');

        $this->assertSame(30.0, $firstPermit->termVolume());
        $this->assertSame(80.0, $renewal->termVolume());
        $this->assertCount(2, $quarry->permits()->get());
    }

    public function test_renewal_endpoint_rejects_overlapping_permit_terms(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $quarry = $this->createQuarry();
        $this->createPermit($quarry, '2026-01-01');

        Sanctum::actingAs($admin);
        $response = $this->postJson(
            "/api/v1/admin/quarries/{$quarry->id}/permits",
            [
                'permit_number' => 'QP-OVERLAP',
                'issued_at' => '2026-12-31',
                'annual_allowable_volume_cubic_meters' => 150,
            ]
        );

        $response->assertUnprocessable()->assertJsonValidationErrors('issued_at');
        $this->assertCount(1, $quarry->permits()->get());
    }

    public function test_operator_submission_is_linked_to_the_active_permit(): void
    {
        Carbon::setTestNow('2026-06-01 10:00:00');

        try {
            $quarry = $this->createQuarry();
            $permit = $this->createPermit($quarry, '2026-01-01', 100);
            $operator = User::factory()->create([
                'role' => 'quarry_operator',
                'quarry_id' => $quarry->id,
                'is_active' => true,
            ]);

            Sanctum::actingAs($operator);
            $response = $this->postJson(
                '/api/v1/operator/hauling-records',
                [
                    'truck_plate_number' => 'ABC-1234',
                    'volume_cubic_meters' => 15,
                    'material_type' => 'Sand',
                    'destination' => 'Bongabong',
                ]
            );

            $response->assertCreated();
            $this->assertDatabaseHas('hauling_records', [
                'quarry_id' => $quarry->id,
                'permit_id' => $permit->id,
                'volume_cubic_meters' => 15,
            ]);
        } finally {
            Carbon::setTestNow();
        }
    }

    private function createQuarry(array $attributes = []): Quarry
    {
        return Quarry::create(array_merge([
            'name' => 'Permit Test Quarry',
            'latitude' => 12.7567,
            'longitude' => 121.3189,
            'status' => 'active',
            'created_by' => User::factory()->create()->id,
        ], $attributes));
    }

    private function createPermit(
        Quarry $quarry,
        string $issuedAt,
        float $allowable = 100,
        string $permitNumber = 'QP-2026-001'
    ): QuarryPermit {
        return QuarryPermit::create([
            'quarry_id' => $quarry->id,
            'permit_number' => $permitNumber,
            'issued_at' => $issuedAt,
            'annual_allowable_volume_cubic_meters' => $allowable,
            'status' => 'active',
            'created_by' => $quarry->created_by,
        ]);
    }

    private function createHaul(
        Quarry $quarry,
        User $operator,
        ?QuarryPermit $permit,
        string $hauledAt,
        float $volume,
        string $status
    ): HaulingRecord {
        return HaulingRecord::create([
            'quarry_id' => $quarry->id,
            'permit_id' => $permit?->id,
            'operator_id' => $operator->id,
            'truck_plate_number' => 'ABC-1234',
            'volume_cubic_meters' => $volume,
            'material_type' => 'Sand',
            'destination' => 'Bongabong',
            'status' => $status,
            'hauled_at' => $hauledAt,
        ]);
    }
}
