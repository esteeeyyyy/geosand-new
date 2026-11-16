<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Application data is maintained through imports and the application UI.
     *
     * Demo records were intentionally removed. User factories remain available
     * for tests, but running db:seed must not recreate mock operational data or
     * overwrite the live imported dataset.
     */
    public function run(): void
    {
        $this->command?->info('Mock operational data seeding is disabled; existing users and live data were preserved.');
    }
}
