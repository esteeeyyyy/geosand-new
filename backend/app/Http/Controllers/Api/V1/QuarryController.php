<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\QuarryResource;
use App\Models\Quarry;
use App\Models\QuarryPermit;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class QuarryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $today = now()->startOfDay()->toDateString();
        $in30Days = now()->addDays(30)->toDateString();

        $quarries = Quarry::with('creator', 'operator', 'staff', 'permits')
            ->withCount('haulingRecords')
            ->when($request->status, fn($q, $status) => $q->where('status', $status))
            ->when($request->permit_status, function ($q, $pStatus) use ($today, $in30Days) {
                if ($pStatus === 'expired') {
                    $q->whereHas('permits', fn ($permit) => $permit->whereDate('expires_at', '<', $today))
                        ->whereDoesntHave('permits', fn ($permit) => $permit->whereDate('expires_at', '>=', $today));
                } elseif ($pStatus === 'expiring_soon') {
                    $q->whereHas('permits', fn ($permit) => $permit
                        ->where('status', 'active')
                        ->whereDate('issued_at', '<=', $today)
                        ->whereDate('expires_at', '>=', $today)
                        ->whereDate('expires_at', '<=', $in30Days));
                } elseif ($pStatus === 'active') {
                    $q->whereHas('permits', fn ($permit) => $permit
                        ->where('status', 'active')
                        ->whereDate('issued_at', '<=', $today)
                        ->whereDate('expires_at', '>', $in30Days));
                } elseif ($pStatus === 'none') {
                    $q->whereDoesntHave('permits');
                }
            })
            ->when($request->search, fn($q, $search) => $q->where('name', 'like', "%{$search}%"))
            ->orderBy('name')
            ->paginate($request->per_page ?? 10);

        $quarries->getCollection()->each(fn (Quarry $quarry) => $quarry->loadPermitTermUsage(true));

        return response()->json([
            'quarries' => QuarryResource::collection($quarries),
            'meta' => [
                'current_page' => $quarries->currentPage(),
                'last_page' => $quarries->lastPage(),
                'total' => $quarries->total(),
            ],
        ]);
    }

    // Public: Apply to be a quarry operator
    public function applyOperator(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'applicant_name'  => 'required|string|max:255',
            'company_name'    => 'required|string|max:255',
            'email'           => 'required|email|max:255',
            'phone'           => 'required|string|max:50',
            'quarry_location' => 'required|string|max:255',
            'permit_number'   => 'nullable|string|max:100',
            'remarks'         => 'nullable|string|max:1000',
        ]);

        AuditLogger::log(
            'applied',
            'OperatorApplication',
            $validated['company_name'],
            null,
            $validated
        );

        return response()->json([
            'message' => 'Thank you for your application! The MENRO Admin team will review your application and contact you shortly.',
            'application' => $validated,
        ], 201);
    }

    public function show(Quarry $quarry): JsonResponse
    {
        $quarry->load('creator', 'operator', 'staff', 'permits');
        $quarry->loadCount('haulingRecords');
        $quarry->loadPermitTermUsage(true);
        $quarry->total_volume = $quarry->permit_term_consumed_volume_cubic_meters;

        return response()->json([
            'quarry' => new QuarryResource($quarry),
        ]);
    }

    /**
     * Download or retrieve the GeoJSON content of the quarry's GIS file.
     * Serves with CORS headers so map frontends can render it directly.
     */
    public function getGisFile(Quarry $quarry)
    {
        if (!$quarry->gis_file_path) {
            return response()->json(['message' => 'No GIS file assigned to this quarry.'], 404);
        }

        $content = null;
        if (Storage::disk('public')->exists($quarry->gis_file_path)) {
            $content = Storage::disk('public')->get($quarry->gis_file_path);
        } elseif (Storage::disk('local')->exists($quarry->gis_file_path)) {
            $content = Storage::disk('local')->get($quarry->gis_file_path);
        }

        if (!$content) {
            return response()->json(['message' => 'GIS file not found on disk.'], 404);
        }

        $decoded = json_decode($content, true);
        if ($decoded !== null) {
            return response()->json($decoded);
        }

        return response($content, 200, ['Content-Type' => 'application/geo+json']);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'polygon_coordinates' => 'nullable|array',
            'polygon_coordinates.*' => 'array|size:2',
            'address' => 'nullable|string|max:500',
            'status' => 'in:active,inactive,pending,suspended,illegal',
            'area_hectares' => 'nullable|numeric|min:0',
            'annual_allowable_volume_cubic_meters' => 'nullable|numeric|min:0',
            'permit_number' => 'nullable|string|max:100',
            'permit_issued_at' => 'nullable|date',
            'permit_expires_at' => 'nullable|date',
        ]);

        // Auto-center marker on polygon centroid
        if (!empty($validated['polygon_coordinates']) && count($validated['polygon_coordinates']) >= 3) {
            $centroid = $this->calculateCentroid($validated['polygon_coordinates']);
            $validated['latitude'] = $centroid[0];
            $validated['longitude'] = $centroid[1];
        }

        $quarry = DB::transaction(function () use ($validated, $request): Quarry {
            $quarryData = Arr::except($validated, [
                'permit_number',
                'permit_issued_at',
                'permit_expires_at',
                'annual_allowable_volume_cubic_meters',
            ]);
            $quarryData['created_by'] = $request->user()->id;
            $quarry = Quarry::create($quarryData);

            if (!empty($validated['permit_number']) && (!empty($validated['permit_issued_at']) || !empty($validated['permit_expires_at']))) {
                $issuedAt = $validated['permit_issued_at']
                    ?? \Carbon\Carbon::parse($validated['permit_expires_at'])->subYearNoOverflow()->toDateString();

                QuarryPermit::create([
                    'quarry_id' => $quarry->id,
                    'permit_number' => $validated['permit_number'],
                    'issued_at' => $issuedAt,
                    'expires_at' => QuarryPermit::expirationDate($issuedAt)->toDateString(),
                    'annual_allowable_volume_cubic_meters' => $validated['annual_allowable_volume_cubic_meters'] ?? null,
                    'status' => 'active',
                    'created_by' => $request->user()->id,
                ]);
            }

            return $quarry;
        });
        $quarry->load('creator', 'operator', 'staff', 'permits');
        $quarry->loadPermitTermUsage(true);

        AuditLogger::log('created', 'Quarry', $quarry->name, $quarry->id);

        return response()->json([
            'message' => 'Quarry created successfully.',
            'quarry' => new QuarryResource($quarry->load('creator', 'operator', 'staff')),
        ], 201);
    }

    public function update(Request $request, Quarry $quarry): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'latitude' => 'sometimes|numeric|between:-90,90',
            'longitude' => 'sometimes|numeric|between:-180,180',
            'polygon_coordinates' => 'nullable|array',
            'polygon_coordinates.*' => 'array|size:2',
            'address' => 'nullable|string|max:500',
            'status' => 'in:active,inactive,pending,suspended,illegal',
            'area_hectares' => 'nullable|numeric|min:0',
        ]);

        // Auto-center marker on polygon centroid
        if (!empty($validated['polygon_coordinates']) && count($validated['polygon_coordinates']) >= 3) {
            $centroid = $this->calculateCentroid($validated['polygon_coordinates']);
            $validated['latitude'] = $centroid[0];
            $validated['longitude'] = $centroid[1];
        }

        $before = $quarry->toArray();
        $quarry->update($validated);
        AuditLogger::log('updated', 'Quarry', $quarry->name, $quarry->id, AuditLogger::diff($before, $quarry->fresh()->toArray()));

        $updatedQuarry = $quarry->fresh()->load('creator', 'operator', 'staff', 'permits');
        $updatedQuarry->loadPermitTermUsage(true);

        return response()->json([
            'message' => 'Quarry updated successfully.',
            'quarry' => new QuarryResource($updatedQuarry),
        ]);
    }

    public function destroy(Quarry $quarry): JsonResponse
    {
        AuditLogger::log('deleted', 'Quarry', $quarry->name, $quarry->id);
        $quarry->delete();
        return response()->json(['message' => 'Quarry deleted successfully.']);
    }

    // Operator/Staff: get my assigned quarry
    public function myQuarry(Request $request): JsonResponse
    {
        $quarry = $request->user()->quarry;

        if (!$quarry) {
            return response()->json(['quarry' => null]);
        }

        $quarry->loadCount('haulingRecords');
        $quarry->loadPermitTermUsage();
        $quarry->total_volume = $quarry->permit_term_consumed_volume_cubic_meters;

        return response()->json([
            'quarry' => new QuarryResource($quarry),
        ]);
    }

    /**
     * Upload (or replace) a GIS file for a quarry.
     * Accepts GeoJSON (.geojson / .json) — coordinates are parsed and stored.
     * KML and Zipped Shapefiles (.kml, .zip) are stored for reference only.
     */
    public function uploadGisFile(Request $request, Quarry $quarry): JsonResponse
    {
        $request->validate([
            'gis_file' => 'required|file|mimes:json,geojson,kml,zip|max:10240',
        ]);

        // Remove old file if present
        if ($quarry->gis_file_path && Storage::exists($quarry->gis_file_path)) {
            Storage::delete($quarry->gis_file_path);
        }

        $file     = $request->file('gis_file');
        $ext      = strtolower($file->getClientOriginalExtension());
        $safeName = $quarry->id . '_' . time() . '.' . $ext;
        $path     = $file->storeAs('public/gis/' . $quarry->id, $safeName);

        $update = ['gis_file_path' => $path];

        // Parse GeoJSON to extract polygon coordinates and area
        if (in_array($ext, ['json', 'geojson'])) {
            $parsed = $this->parseGeoJson(file_get_contents($file->getRealPath()));
            if ($parsed) {
                $update['polygon_coordinates'] = $parsed['coordinates'];
                if ($parsed['area_hectares'] !== null) {
                    $update['area_hectares'] = $parsed['area_hectares'];
                }
                // Auto-center on polygon centroid
                $centroid = $this->calculateCentroid($parsed['coordinates']);
                $update['latitude']  = $centroid[0];
                $update['longitude'] = $centroid[1];
            }
        }

        $quarry->update($update);

        AuditLogger::log('uploaded_gis', 'Quarry', $quarry->name, $quarry->id, ['file' => $safeName]);

        return response()->json([
            'message' => 'GIS file uploaded successfully.',
            'quarry'  => new QuarryResource($quarry->fresh()->load('creator', 'operator', 'staff')),
        ]);
    }

    /**
     * Delete the GIS file associated with a quarry.
     * Polygon coordinates are retained (they were already saved).
     */
    public function deleteGisFile(Quarry $quarry): JsonResponse
    {
        if ($quarry->gis_file_path && Storage::exists($quarry->gis_file_path)) {
            Storage::delete($quarry->gis_file_path);
        }

        $quarry->update(['gis_file_path' => null]);

        AuditLogger::log('deleted_gis', 'Quarry', $quarry->name, $quarry->id);

        return response()->json([
            'message' => 'GIS file removed.',
            'quarry'  => new QuarryResource($quarry->fresh()->load('creator', 'operator', 'staff')),
        ]);
    }

    /**
     * Parse a raw GeoJSON string and return the first polygon's
     * [lat, lng] coordinate pairs plus the area in hectares (if calculable).
     *
     * @return array{coordinates: array, area_hectares: float|null}|null
     */
    private function parseGeoJson(string $raw): ?array
    {
        $data = json_decode($raw, true);
        if (!$data) {
            return null;
        }

        $ring = null;

        if (($data['type'] ?? '') === 'FeatureCollection') {
            foreach ($data['features'] ?? [] as $feature) {
                $ring = $this->extractRingFromGeometry($feature['geometry'] ?? []);
                if ($ring) break;
            }
        } elseif (($data['type'] ?? '') === 'Feature') {
            $ring = $this->extractRingFromGeometry($data['geometry'] ?? []);
        } else {
            $ring = $this->extractRingFromGeometry($data);
        }

        if (!$ring || count($ring) < 3) {
            return null;
        }

        // GeoJSON rings are [lng, lat]; we store [lat, lng]
        $coords = array_map(fn($pt) => [$pt[1], $pt[0]], $ring);

        return [
            'coordinates'  => $coords,
            'area_hectares' => $this->calculatePolygonAreaHectares($ring),
        ];
    }

    /**
     * Extract the outer ring from a GeoJSON Geometry object.
     * Returns an array of [lng, lat] pairs, or null on unsupported type.
     */
    private function extractRingFromGeometry(array $geometry): ?array
    {
        $type = $geometry['type'] ?? '';

        if ($type === 'Polygon') {
            return $geometry['coordinates'][0] ?? null;  // outer ring
        }

        if ($type === 'MultiPolygon') {
            return $geometry['coordinates'][0][0] ?? null; // first polygon outer ring
        }

        return null;
    }

    /**
     * Calculate the area of a GeoJSON polygon ring ([lng, lat] pairs) in hectares
     * using the spherical excess (Shoelace) approximation.
     */
    private function calculatePolygonAreaHectares(array $ring): float
    {
        $n = count($ring);
        if ($n < 3) return 0.0;

        $area = 0.0;
        $R    = 6378137.0; // Earth radius in metres

        for ($i = 0; $i < $n; $i++) {
            $j    = ($i + 1) % $n;
            $xi   = deg2rad($ring[$i][0]); // lng
            $yi   = deg2rad($ring[$i][1]); // lat
            $xj   = deg2rad($ring[$j][0]);
            $yj   = deg2rad($ring[$j][1]);
            $area += ($xj - $xi) * (2 + sin($yi) + sin($yj));
        }

        $areaSqM = abs($area) * ($R * $R) / 2.0;
        return round($areaSqM / 10000, 2); // convert m² → hectares
    }

    /**
     * Calculate the centroid (geometric center) of a polygon.
     * @param array $coordinates [[lat, lng], [lat, lng], ...]
     * @return array [lat, lng]
     */
    private function calculateCentroid(array $coordinates): array
    {
        $latSum = 0;
        $lngSum = 0;
        $count = count($coordinates);

        foreach ($coordinates as $point) {
            $latSum += $point[0];
            $lngSum += $point[1];
        }

        return [
            round($latSum / $count, 7),
            round($lngSum / $count, 7),
        ];
    }

    /**
     * Get Naive Bayes AI Terrain Grading for a specific quarry GIS file/polygon.
     */
    public function aiTerrainAnalysis(Quarry $quarry): JsonResponse
    {
        $analysis = $quarry->ai_terrain_analysis;

        return response()->json([
            'quarry_id'   => $quarry->id,
            'quarry_name' => $quarry->name,
            'analysis'    => $analysis,
        ]);
    }

    /**
     * Run real-time Naive Bayes AI Terrain Grading on uploaded/provided GIS elevation data.
     */
    public function analyzeGisElevation(Request $request): JsonResponse
    {
        $request->validate([
            'gis_file'    => 'nullable|file|mimes:json,geojson,kml,zip|max:10240',
            'geojson_raw' => 'nullable|string',
            'elevation'   => 'nullable|numeric',
            'slope'       => 'nullable|numeric',
            'pit_depth'   => 'nullable|numeric',
        ]);

        $classifier = new \App\Services\NaiveBayesTerrainClassifier();

        if ($request->hasFile('gis_file')) {
            $content = file_get_contents($request->file('gis_file')->getRealPath());
            $result = $classifier->analyzeGisData($content);
        } elseif ($request->filled('geojson_raw')) {
            $result = $classifier->analyzeGisData($request->geojson_raw);
        } elseif ($request->has('elevation')) {
            $result = $classifier->classifyPoint(
                (float) $request->input('elevation'),
                (float) $request->input('slope', 5.0),
                (float) $request->input('pit_depth', 0.0)
            );
        } else {
            return response()->json([
                'message' => 'Please provide a GIS file, raw GeoJSON string, or numerical elevation parameters.',
            ], 422);
        }

        return response()->json([
            'message'  => 'Naive Bayes AI terrain grading completed.',
            'analysis' => $result,
        ]);
    }
}

