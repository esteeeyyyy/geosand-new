const OFFLINE_MAP_INFO_KEY = 'geosand_offline_map_info';

const basemaps = [
  {
    id: 'street',
    layer: 'base-street',
    cacheName: 'map-tiles-cache',
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  },
  {
    id: 'satellite',
    layer: 'base-satellite',
    cacheName: 'geosand-basemap-cache',
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  },
  {
    id: 'topo',
    layer: 'base-topo',
    cacheName: 'geosand-basemap-cache',
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
  },
];

const clampLatitude = (latitude) => Math.max(-85.05112878, Math.min(85.05112878, latitude));

const longitudeToTile = (longitude, zoom) => {
  const count = 2 ** zoom;
  return Math.max(0, Math.min(count - 1, Math.floor(((longitude + 180) / 360) * count)));
};

const latitudeToTile = (latitude, zoom) => {
  const radians = clampLatitude(latitude) * Math.PI / 180;
  const count = 2 ** zoom;
  const value = Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * count);
  return Math.max(0, Math.min(count - 1, value));
};

const tilesForBounds = (bounds, zoom) => {
  const west = longitudeToTile(bounds.getWest(), zoom);
  const east = longitudeToTile(bounds.getEast(), zoom);
  const north = latitudeToTile(bounds.getNorth(), zoom);
  const south = latitudeToTile(bounds.getSouth(), zoom);
  const tiles = [];

  for (let x = Math.min(west, east); x <= Math.max(west, east); x += 1) {
    for (let y = Math.min(north, south); y <= Math.max(north, south); y += 1) {
      tiles.push({ z: zoom, x, y });
    }
  }

  return tiles;
};

const activeBasemap = (map) => basemaps.find(({ layer }) => {
  if (!map.getLayer(layer)) return false;
  return map.getLayoutProperty(layer, 'visibility') !== 'none';
}) || basemaps[0];

const cacheRequests = async (requests, onProgress) => {
  let saved = 0;
  let failed = 0;
  let cursor = 0;
  const total = requests.length;

  const worker = async () => {
    while (cursor < total) {
      const current = requests[cursor];
      cursor += 1;

      try {
        const cache = await caches.open(current.cacheName);
        const cached = await cache.match(current.url);
        if (!cached) {
          const response = await fetch(current.url);
          if (!response.ok && response.type !== 'opaque') throw new Error(`Tile request failed: ${response.status}`);
          await cache.put(current.url, response.clone());
        }
        saved += 1;
      } catch {
        failed += 1;
      }

      onProgress?.({ completed: saved + failed, total, saved, failed });
    }
  };

  await Promise.all(Array.from({ length: Math.min(6, total) }, worker));
  return { saved, failed, total };
};

export const getOfflineMapInfo = () => {
  try {
    const stored = localStorage.getItem(OFFLINE_MAP_INFO_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export async function cacheCurrentMapView(map, onProgress) {
  if (!map || !map.isStyleLoaded()) throw new Error('Wait for the map to finish loading.');
  if (!navigator.onLine) throw new Error('Connect to the internet before saving a new offline area.');
  if (!('caches' in window)) throw new Error('Offline map storage is not supported by this browser.');

  const bounds = map.getBounds();
  const currentZoom = Math.max(8, Math.min(16, Math.floor(map.getZoom())));
  const zoomLevels = [...new Set([
    Math.max(8, currentZoom - 1),
    currentZoom,
    Math.min(16, currentZoom + 1),
  ])];
  const selectedBasemap = activeBasemap(map);
  const requests = [];

  zoomLevels.forEach((zoom) => {
    tilesForBounds(bounds, zoom).forEach(({ z, x, y }) => {
      requests.push({ cacheName: selectedBasemap.cacheName, url: selectedBasemap.url(z, x, y) });
      if (z <= 15) {
        requests.push({
          cacheName: 'geosand-terrain-cache',
          url: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
        });
      }
    });
  });

  const uniqueRequests = [...new Map(requests.map((request) => [request.url, request])).values()];
  const result = await cacheRequests(uniqueRequests, onProgress);
  if (!result.saved) throw new Error('The map area could not be saved. Please try again.');

  const info = {
    savedAt: new Date().toISOString(),
    basemap: selectedBasemap.id,
    tileCount: result.saved,
    failedCount: result.failed,
    zoomLevels,
    bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
  };
  localStorage.setItem(OFFLINE_MAP_INFO_KEY, JSON.stringify(info));
  return info;
}
