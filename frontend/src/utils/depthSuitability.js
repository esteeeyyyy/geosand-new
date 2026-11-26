export const DEPTH_SUITABILITY = {
  good: {
    key: 'good',
    label: 'Good',
    color: '#22C55E',
    range: 'Shallower ground',
    rank: 'Higher ground within quarry',
  },
  fair: {
    key: 'fair',
    label: 'Fair',
    color: '#FACC15',
    range: 'Moderately deep',
    rank: 'Mid elevation within quarry',
  },
  unsuitable: {
    key: 'unsuitable',
    label: 'Not suitable',
    color: '#EF4444',
    range: 'Very deep',
    rank: 'Lowest ground within quarry',
  },
};

const numericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const deepestNegativeCoordinate = (coordinates) => {
  let depth = null;

  const visit = (value) => {
    if (!Array.isArray(value)) return;

    if (value.length >= 2 && !Array.isArray(value[0])) {
      const elevation = numericValue(value[2]);
      if (elevation !== null && elevation < 0) {
        depth = Math.max(depth ?? 0, Math.abs(elevation));
      }
      return;
    }

    value.forEach(visit);
  };

  visit(coordinates);
  return depth;
};

export const getDepthSuitability = (depthValue) => {
  const depth = Math.max(0, Math.abs(numericValue(depthValue) ?? 0));

  if (depth > 28) return { ...DEPTH_SUITABILITY.unsuitable, depth };
  if (depth > 15) return { ...DEPTH_SUITABILITY.fair, depth };
  return { ...DEPTH_SUITABILITY.good, depth };
};

export const getFeatureDepth = (feature) => {
  const properties = feature?.properties || {};
  const explicitDepth = [
    properties.depth_m,
    properties.excavation_depth_m,
    properties.pit_depth,
    properties.depth,
  ].map(numericValue).find((value) => value !== null);

  if (explicitDepth !== undefined) return Math.abs(explicitDepth);

  const elevation = numericValue(properties.elevation);
  if (elevation !== null && elevation < 0) return Math.abs(elevation);

  return deepestNegativeCoordinate(feature?.geometry?.coordinates) ?? 0;
};

export const getQuarryDepthSuitability = (quarry) => {
  const depth = quarry?.ai_terrain_analysis?.summary_metrics?.deepest_pit_depth;
  return getDepthSuitability(depth);
};

const TERRAIN_ZOOM = 14;
const terrainTileCache = new Map();

const quarryBoundary = (quarry) => {
  let rawPolygon = quarry?.polygon_coordinates;
  if (typeof rawPolygon === 'string') {
    try { rawPolygon = JSON.parse(rawPolygon); } catch { rawPolygon = null; }
  }

  const polygon = Array.isArray(rawPolygon)
    ? rawPolygon
      .map((point) => [Number(point?.[1]), Number(point?.[0])])
      .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude))
    : [];

  if (polygon.length >= 3) {
    const first = polygon[0];
    const last = polygon[polygon.length - 1];
    return first[0] === last[0] && first[1] === last[1] ? polygon.slice(0, -1) : polygon;
  }

  const longitude = Number(quarry?.longitude);
  const latitude = Number(quarry?.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];

  // Point-only quarry records receive a small estimated footprint so the
  // modeled internal suitability surface is still visible on the map.
  const latitudeRadius = 0.0012;
  const longitudeRadius = latitudeRadius / Math.max(Math.cos(latitude * Math.PI / 180), 0.2);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((index * 60) - 30) * Math.PI / 180;
    return [
      longitude + (Math.cos(angle) * longitudeRadius),
      latitude + (Math.sin(angle) * latitudeRadius),
    ];
  });
};

export const createQuarryDepthZoneFeatures = (quarry) => {
  const boundary = quarryBoundary(quarry);
  if (boundary.length < 3) return [];

  const isInsideBoundary = ([longitude, latitude]) => {
    let inside = false;
    for (let current = 0, previous = boundary.length - 1; current < boundary.length; previous = current++) {
      const [currentLng, currentLat] = boundary[current];
      const [previousLng, previousLat] = boundary[previous];
      const crossesLatitude = (currentLat > latitude) !== (previousLat > latitude);
      const crossingLongitude = ((previousLng - currentLng) * (latitude - currentLat))
        / ((previousLat - currentLat) || Number.EPSILON) + currentLng;
      if (crossesLatitude && longitude < crossingLongitude) inside = !inside;
    }
    return inside;
  };

  const longitudes = boundary.map(([longitude]) => longitude);
  const latitudes = boundary.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  // Denser sampling keeps the glow continuous as the map zooms in.
  const gridSize = 12;
  const samples = [];

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const samplePoint = [
        minLongitude + ((column + 0.5) / gridSize) * (maxLongitude - minLongitude),
        minLatitude + ((row + 0.5) / gridSize) * (maxLatitude - minLatitude),
      ];
      if (isInsideBoundary(samplePoint)) samples.push(samplePoint);
    }
  }

  if (!samples.length) {
    samples.push(boundary.reduce(
      (total, coordinate) => [total[0] + coordinate[0], total[1] + coordinate[1]],
      [0, 0],
    ).map((total) => total / boundary.length));
  }

  return samples.map((samplePoint, index) => {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: samplePoint,
      },
      properties: {
        quarry_id: quarry?.id,
        quarry_name: quarry?.name || 'Quarry',
        type_name: 'ElevationSample',
        sample_number: index + 1,
        sample_longitude: samplePoint[0],
        sample_latitude: samplePoint[1],
        elevation_m: null,
        depth_suitability: 'pending',
        depth_label: 'Loading elevation',
        depth_color: '#94A3B8',
        heatmap_weight: 0,
        depth_source: 'Topographic DEM pending',
      },
    };
  });
};

const terrainTilePosition = (longitude, latitude) => {
  const size = 2 ** TERRAIN_ZOOM;
  const x = ((longitude + 180) / 360) * size;
  const latitudeRadians = latitude * Math.PI / 180;
  const y = (1 - (Math.asinh(Math.tan(latitudeRadians)) / Math.PI)) / 2 * size;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);

  return {
    tileX,
    tileY,
    pixelX: Math.max(0, Math.min(255, Math.floor((x - tileX) * 256))),
    pixelY: Math.max(0, Math.min(255, Math.floor((y - tileY) * 256))),
  };
};

const loadTerrainTile = async (tileX, tileY) => {
  const cacheKey = `${TERRAIN_ZOOM}/${tileX}/${tileY}`;
  if (terrainTileCache.has(cacheKey)) return terrainTileCache.get(cacheKey);

  const pending = fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${cacheKey}.png`)
    .then((response) => {
      if (!response.ok) throw new Error(`Terrain tile unavailable (${response.status})`);
      return response.blob();
    })
    .then(async (blob) => {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, 256, 256);
      bitmap.close?.();
      return context.getImageData(0, 0, 256, 256).data;
    })
    .catch((error) => {
      terrainTileCache.delete(cacheKey);
      throw error;
    });

  terrainTileCache.set(cacheKey, pending);
  return pending;
};

const sampleTopographicElevation = async (longitude, latitude) => {
  const position = terrainTilePosition(longitude, latitude);
  const pixels = await loadTerrainTile(position.tileX, position.tileY);
  const offset = ((position.pixelY * 256) + position.pixelX) * 4;
  return (pixels[offset] * 256) + pixels[offset + 1] + (pixels[offset + 2] / 256) - 32768;
};

export const applyTopographicElevationHeatmap = async (geojson) => {
  if (!geojson || !Array.isArray(geojson.features)) return geojson;

  const sampled = await Promise.all(geojson.features.map(async (feature) => {
    if (feature?.properties?.type_name !== 'ElevationSample') return feature;

    const longitude = numericValue(feature.properties.sample_longitude);
    const latitude = numericValue(feature.properties.sample_latitude);
    if (longitude === null || latitude === null) return feature;

    try {
      const elevation = await sampleTopographicElevation(longitude, latitude);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          elevation_m: Number(elevation.toFixed(1)),
          depth_source: 'Terrarium topographic DEM',
        },
      };
    } catch {
      return {
        ...feature,
        properties: {
          ...feature.properties,
          depth_label: 'Elevation unavailable',
          depth_source: 'Topographic DEM unavailable',
        },
      };
    }
  }));

  const zonesByQuarry = new Map();
  sampled.forEach((feature) => {
    if (feature?.properties?.type_name !== 'ElevationSample') return;
    if (numericValue(feature.properties.elevation_m) === null) return;
    const quarryId = String(feature.properties.quarry_id ?? 'unknown');
    if (!zonesByQuarry.has(quarryId)) zonesByQuarry.set(quarryId, []);
    zonesByQuarry.get(quarryId).push(feature);
  });

  const classified = new Map();
  zonesByQuarry.forEach((zones) => {
    const ordered = [...zones].sort((a, b) => Number(a.properties.elevation_m) - Number(b.properties.elevation_m));
    ordered.forEach((feature, index) => {
      const relativeElevation = (index + 0.5) / ordered.length;
      // Most of the site remains good; caution covers the next deeper band,
      // while red is limited to the lowest, deepest pockets.
      const bucket = relativeElevation <= 0.08 ? 2 : relativeElevation <= 0.3 ? 1 : 0;
      const suitability = bucket === 2
        ? DEPTH_SUITABILITY.unsuitable
        : bucket === 1
          ? DEPTH_SUITABILITY.fair
          : DEPTH_SUITABILITY.good;
      classified.set(feature, {
        ...feature,
        properties: {
          ...feature.properties,
          depth_suitability: suitability.key,
          depth_label: suitability.label,
          depth_color: suitability.color,
          heatmap_weight: bucket === 2 ? 0.4 : bucket === 1 ? 0.12 : 0.04,
          elevation_rank: suitability.rank,
        },
      });
    });
  });

  return {
    ...geojson,
    features: sampled.map((feature) => classified.get(feature) || feature),
  };
};

export const prepareDepthHeatmapGeoJson = (geojson) => {
  if (!geojson || !Array.isArray(geojson.features)) {
    return {
      geojson,
      summary: { good: 0, fair: 0, unsuitable: 0, zones: 0 },
    };
  }

  const summary = { good: 0, fair: 0, unsuitable: 0, zones: 0 };
  const features = geojson.features.map((feature) => {
    if (!['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type)) return feature;

    const suitability = getDepthSuitability(getFeatureDepth(feature));
    summary[suitability.key] += 1;
    summary.zones += 1;

    return {
      ...feature,
      properties: {
        ...(feature.properties || {}),
        depth_m: Number(suitability.depth.toFixed(2)),
        depth_suitability: suitability.key,
        depth_label: suitability.label,
        depth_color: suitability.color,
      },
    };
  });

  return {
    geojson: { ...geojson, features },
    summary,
  };
};
