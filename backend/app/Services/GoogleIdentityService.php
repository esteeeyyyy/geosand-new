<?php

namespace App\Services;

use Google\Client;

class GoogleIdentityService
{
    public function isConfigured(): bool
    {
        $clientId = trim((string) config('services.google.client_id'));

        return $clientId !== '' && !str_starts_with($clientId, 'your-');
    }

    /**
     * Verify a Google Identity Services credential and return its claims.
     *
     * @return array<string, mixed>|null
     */
    public function verifyIdToken(string $credential): ?array
    {
        if (!$this->isConfigured()) {
            return null;
        }

        $client = new Client([
            'client_id' => config('services.google.client_id'),
        ]);

        $payload = $client->verifyIdToken($credential);

        return is_array($payload) ? $payload : null;
    }
}
