<?php

namespace Tests\Unit;

use App\Services\NaiveBayesAnalyticsService;
use PHPUnit\Framework\TestCase;

class NaiveBayesAnalyticsServiceTest extends TestCase
{
    public function test_productivity_forecast_uses_gaussian_naive_bayes(): void
    {
        $result = (new NaiveBayesAnalyticsService())->analyzeProductivity([
            ['total_volume' => 90, 'count' => 9],
            ['total_volume' => 100, 'count' => 10],
            ['total_volume' => 115, 'count' => 12],
            ['total_volume' => 130, 'count' => 14],
        ]);

        $this->assertSame('ready', $result['status']);
        $this->assertSame('Gaussian Naive Bayes', $result['model_info']['algorithm']);
        $this->assertCount(3, $result['forecast_series']);
        $this->assertEqualsWithDelta(1.0, array_sum($result['probabilities']), 0.001);
    }

    public function test_environmental_analysis_classifies_low_and_high_risk_inputs(): void
    {
        $service = new NaiveBayesAnalyticsService();
        $lowRisk = $service->analyzeEnvironment([[
            'river_setback_m' => 55, 'water_turbidity_ntu' => 12, 'air_quality_pm25' => 15,
            'noise_level_db' => 55, 'excavation_depth_m' => 8, 'flood_risk' => 'low',
        ]]);
        $highRisk = $service->analyzeEnvironment([[
            'river_setback_m' => 12, 'water_turbidity_ntu' => 80, 'air_quality_pm25' => 78,
            'noise_level_db' => 105, 'excavation_depth_m' => 40, 'flood_risk' => 'high',
        ]]);

        $this->assertSame('GREEN', $lowRisk['grade']);
        $this->assertSame('RED', $highRisk['grade']);
        $this->assertEqualsWithDelta(1.0, array_sum($highRisk['probabilities']), 0.001);
    }

    public function test_models_refuse_to_invent_results_without_data(): void
    {
        $service = new NaiveBayesAnalyticsService();

        $this->assertSame('insufficient_data', $service->analyzeProductivity([])['status']);
        $this->assertSame('insufficient_data', $service->analyzeEnvironment([])['status']);
    }
}
