<?php

namespace App\Services;

class NaiveBayesAnalyticsService
{
    private const PRODUCTIVITY_MODEL = [
        'LOW' => [
            'prior' => 0.30,
            'label' => 'Low productivity',
            'color' => '#EF4444',
            'factor' => 0.90,
            'features' => [
                'volume_ratio' => ['mu' => 0.65, 'var' => 0.04],
                'momentum_pct' => ['mu' => -15.0, 'var' => 100.0],
                'load_ratio' => ['mu' => 0.70, 'var' => 0.06],
            ],
            'recommendation' => 'Production is likely to remain below its historical baseline. Review permit, demand, equipment, and access constraints.',
        ],
        'STABLE' => [
            'prior' => 0.45,
            'label' => 'Stable productivity',
            'color' => '#0F766E',
            'factor' => 1.00,
            'features' => [
                'volume_ratio' => ['mu' => 1.00, 'var' => 0.04],
                'momentum_pct' => ['mu' => 0.0, 'var' => 100.0],
                'load_ratio' => ['mu' => 1.00, 'var' => 0.06],
            ],
            'recommendation' => 'Production is likely to remain near its historical baseline under current operating conditions.',
        ],
        'HIGH' => [
            'prior' => 0.25,
            'label' => 'High productivity',
            'color' => '#2563EB',
            'factor' => 1.10,
            'features' => [
                'volume_ratio' => ['mu' => 1.35, 'var' => 0.06],
                'momentum_pct' => ['mu' => 15.0, 'var' => 144.0],
                'load_ratio' => ['mu' => 1.30, 'var' => 0.08],
            ],
            'recommendation' => 'Higher-than-baseline production is likely. Confirm extraction ceilings, hauling capacity, and environmental safeguards.',
        ],
    ];

    private const ENVIRONMENT_MODEL = [
        'GREEN' => [
            'prior' => 0.40,
            'label' => 'Low environmental risk',
            'color' => '#16A34A',
            'features' => [
                'river_setback_m' => ['mu' => 55.0, 'var' => 144.0],
                'water_turbidity_ntu' => ['mu' => 12.0, 'var' => 64.0],
                'air_quality_pm25' => ['mu' => 15.0, 'var' => 64.0],
                'noise_level_db' => ['mu' => 55.0, 'var' => 64.0],
                'excavation_depth_m' => ['mu' => 8.0, 'var' => 36.0],
                'flood_risk_score' => ['mu' => 0.0, 'var' => 0.25],
            ],
            'recommendation' => 'Observed conditions most closely match the low-risk class. Continue routine monitoring and rehabilitation.',
        ],
        'YELLOW' => [
            'prior' => 0.35,
            'label' => 'Moderate environmental risk',
            'color' => '#D97706',
            'features' => [
                'river_setback_m' => ['mu' => 35.0, 'var' => 100.0],
                'water_turbidity_ntu' => ['mu' => 35.0, 'var' => 144.0],
                'air_quality_pm25' => ['mu' => 35.0, 'var' => 144.0],
                'noise_level_db' => ['mu' => 75.0, 'var' => 100.0],
                'excavation_depth_m' => ['mu' => 20.0, 'var' => 64.0],
                'flood_risk_score' => ['mu' => 1.0, 'var' => 0.25],
            ],
            'recommendation' => 'Observed conditions most closely match the caution class. Increase inspection frequency and document corrective controls.',
        ],
        'RED' => [
            'prior' => 0.25,
            'label' => 'High environmental risk',
            'color' => '#DC2626',
            'features' => [
                'river_setback_m' => ['mu' => 15.0, 'var' => 100.0],
                'water_turbidity_ntu' => ['mu' => 75.0, 'var' => 400.0],
                'air_quality_pm25' => ['mu' => 75.0, 'var' => 400.0],
                'noise_level_db' => ['mu' => 100.0, 'var' => 144.0],
                'excavation_depth_m' => ['mu' => 38.0, 'var' => 144.0],
                'flood_risk_score' => ['mu' => 2.0, 'var' => 0.25],
            ],
            'recommendation' => 'Observed conditions most closely match the high-risk class. Suspend affected work and perform a formal compliance review.',
        ],
    ];

    public function analyzeProductivity(array $history, int $months = 3): array
    {
        $rows = array_values(array_filter(array_map(function ($row) {
            $volume = (float) ($row['total_volume'] ?? 0);
            if ($volume <= 0) return null;
            return ['volume' => $volume, 'count' => max(0, (int) ($row['count'] ?? 0))];
        }, $history)));

        if ($rows === []) {
            return $this->insufficient('productivity', 'At least one verified production period is required for Naive Bayes classification.');
        }

        $volumes = array_column($rows, 'volume');
        $counts = array_column($rows, 'count');
        $historicalAverage = array_sum($volumes) / count($volumes);
        $averageLoads = max(array_sum($counts) / max(count($counts), 1), 1.0);
        $recentRows = array_slice($rows, -min(3, count($rows)));
        $recentAverage = array_sum(array_column($recentRows, 'volume')) / count($recentRows);
        $recentLoads = array_sum(array_column($recentRows, 'count')) / count($recentRows);

        if (count($rows) >= 2) {
            $previousVolume = $rows[count($rows) - 2]['volume'];
            $latestVolume = $rows[count($rows) - 1]['volume'];
            $momentum = $previousVolume > 0 ? (($latestVolume - $previousVolume) / $previousVolume) * 100 : 0.0;
        } else {
            $momentum = 0.0;
        }
        $momentum = max(-40.0, min(40.0, $momentum));

        $features = [
            'volume_ratio' => $recentAverage / max($historicalAverage, 0.01),
            'momentum_pct' => $momentum,
            'load_ratio' => $recentLoads / $averageLoads,
        ];
        $classification = $this->classify($features, self::PRODUCTIVITY_MODEL);
        $classConfig = self::PRODUCTIVITY_MODEL[$classification['class']];
        $classFactor = $classConfig['factor'];
        $momentumFactor = ($momentum / 100) * 0.25;
        $confidence = $classification['confidence'] / 100;
        $uncertainty = max(0.08, 0.22 * (1 - $confidence));
        $forecast = [];

        for ($index = 0; $index < $months; $index++) {
            $decay = 1 / ($index + 1);
            $factor = 1 + (($classFactor - 1) * $decay) + ($momentumFactor * $decay);
            $predicted = max(0, $recentAverage * pow($factor, $index + 1));
            $band = $uncertainty + ($index * 0.025);
            $forecast[] = [
                'offset' => $index + 1,
                'predicted_volume' => round($predicted, 2),
                'lower_bound' => round($predicted * (1 - $band), 2),
                'upper_bound' => round($predicted * (1 + $band), 2),
            ];
        }

        return [
            'status' => 'ready',
            'classification' => $classification['class'],
            'classification_label' => $classification['label'],
            'color' => $classification['color'],
            'confidence' => $classification['confidence'],
            'probabilities' => $classification['probabilities'],
            'recommendation' => $classification['recommendation'],
            'average_monthly_volume' => round($historicalAverage, 2),
            'recent_average_volume' => round($recentAverage, 2),
            'observed_momentum_pct' => round($momentum, 2),
            'monthly_growth_rate_pct' => isset($forecast[0]) ? round((($forecast[0]['predicted_volume'] / max($recentAverage, 0.01)) - 1) * 100, 2) : 0,
            'projected_next_month_volume' => $forecast[0]['predicted_volume'] ?? 0,
            'quarterly_forecast_volume' => round(array_sum(array_column($forecast, 'predicted_volume')), 2),
            'forecast_series' => $forecast,
            'quota_depletion_forecast' => "Naive Bayes class: {$classification['label']} ({$classification['confidence']}% confidence).",
            'input_metrics' => array_map(fn ($value) => round($value, 4), $features),
            'model_info' => [
                'algorithm' => 'Gaussian Naive Bayes',
                'purpose' => 'Productivity class and class-conditioned volume forecast',
                'classes' => ['LOW', 'STABLE', 'HIGH'],
                'training_basis' => 'Domain-calibrated priors with observed quarry production features',
                'periods_evaluated' => count($rows),
            ],
        ];
    }

    public function analyzeEnvironment(array $records): array
    {
        $featureColumns = [
            'river_setback_m', 'water_turbidity_ntu', 'air_quality_pm25', 'noise_level_db', 'excavation_depth_m',
        ];
        $features = [];

        foreach ($featureColumns as $column) {
            $values = array_values(array_filter(array_map(
                fn ($record) => isset($record[$column]) && $record[$column] !== null ? (float) $record[$column] : null,
                $records
            ), fn ($value) => $value !== null));
            if ($values !== []) $features[$column] = array_sum($values) / count($values);
        }

        $riskScores = ['low' => 0.0, 'moderate' => 1.0, 'high' => 2.0];
        $floodValues = array_values(array_filter(array_map(
            fn ($record) => isset($riskScores[$record['flood_risk'] ?? '']) ? $riskScores[$record['flood_risk']] : null,
            $records
        ), fn ($value) => $value !== null));
        if ($floodValues !== []) $features['flood_risk_score'] = array_sum($floodValues) / count($floodValues);

        if ($features === []) {
            return $this->insufficient('environment', 'Field measurements are required for Naive Bayes environmental classification.');
        }

        $classification = $this->classify($features, self::ENVIRONMENT_MODEL);

        return [
            'status' => 'ready',
            'grade' => $classification['class'],
            'grade_label' => $classification['label'],
            'color' => $classification['color'],
            'confidence' => $classification['confidence'],
            'probabilities' => $classification['probabilities'],
            'recommendation' => $classification['recommendation'],
            'input_metrics' => array_map(fn ($value) => round($value, 2), $features),
            'model_info' => [
                'algorithm' => 'Gaussian Naive Bayes',
                'purpose' => 'Environmental risk classification',
                'classes' => ['GREEN', 'YELLOW', 'RED'],
                'training_basis' => 'Domain-calibrated priors with recorded field measurements',
                'records_evaluated' => count($records),
            ],
        ];
    }

    private function classify(array $features, array $model): array
    {
        $logLikelihoods = [];
        foreach ($model as $class => $config) {
            $logLikelihood = log($config['prior']);
            foreach ($features as $feature => $value) {
                if (!isset($config['features'][$feature])) continue;
                $params = $config['features'][$feature];
                $logLikelihood += log(max($this->gaussianPdf((float) $value, $params['mu'], $params['var']), 1e-12));
            }
            $logLikelihoods[$class] = $logLikelihood;
        }

        $maxLog = max($logLikelihoods);
        $weights = array_map(fn ($value) => exp($value - $maxLog), $logLikelihoods);
        $total = array_sum($weights);
        $probabilities = [];
        $winner = array_key_first($weights);
        $winningProbability = -1.0;

        foreach ($weights as $class => $weight) {
            $probability = $total > 0 ? $weight / $total : 1 / count($weights);
            $probabilities[strtolower($class)] = round($probability, 4);
            if ($probability > $winningProbability) {
                $winningProbability = $probability;
                $winner = $class;
            }
        }

        return [
            'class' => $winner,
            'label' => $model[$winner]['label'],
            'color' => $model[$winner]['color'],
            'confidence' => round($winningProbability * 100, 1),
            'probabilities' => $probabilities,
            'recommendation' => $model[$winner]['recommendation'],
        ];
    }

    private function gaussianPdf(float $value, float $mean, float $variance): float
    {
        $variance = max($variance, 1e-6);
        return (1 / sqrt(2 * M_PI * $variance)) * exp(-pow($value - $mean, 2) / (2 * $variance));
    }

    private function insufficient(string $purpose, string $message): array
    {
        return [
            'status' => 'insufficient_data',
            'message' => $message,
            'confidence' => 0,
            'probabilities' => [],
            'forecast_series' => [],
            'projected_next_month_volume' => 0,
            'quarterly_forecast_volume' => 0,
            'average_monthly_volume' => 0,
            'model_info' => [
                'algorithm' => 'Gaussian Naive Bayes',
                'purpose' => $purpose,
            ],
        ];
    }
}
