import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapLayerControl } from '../../components/MapLayerToggle';
import { GeolocationControl, FullscreenControl, ScaleBar, CoordinateDisplay, MapControlsToolbar } from '../../components/MapControls';
import { getQuarry, getQuarryGisFile } from '../../api/quarries';
import { getCheckpoints } from '../../api/checkpoints';
import { createMapBoundaryOverlay } from '../../utils/mapBoundaryOverlay';
import { ArrowLeft, MapPin, FileText, Ruler, ShieldCheck, ChevronLeft, ChevronRight, Calendar, AlertTriangle, XCircle } from 'lucide-react';

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const statusColors = {
  active: '#0F766E',
  inactive: '#9CA3AF',
  suspended: '#D97706',
};

export default function QuarryDetail() {
  const { id } = useParams();
  const [quarry, setQuarry] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [is3D, setIs3D] = useState(false);
  const [cardCollapsed, setCardCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [gisDetailInfo, setGisDetailInfo] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapObj, setMapObj] = useState(null);

  useEffect(() => {
    Promise.all([
      getQuarry(id),
      getCheckpoints({ per_page: 100 }).catch(() => ({ data: { checkpoints: [] } })),
    ])
      .then(([quarryResponse, checkpointResponse]) => {
        setQuarry(quarryResponse.data.quarry);
        setCheckpoints(checkpointResponse.data.checkpoints || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!mapContainerRef.current || !quarry) return;

    const boundaryDomMarkers = [];
    let boundaryLineCleanup = () => {};

    const center = [
      quarry.longitude ? parseFloat(quarry.longitude) : 121.4892,
      quarry.latitude ? parseFloat(quarry.latitude) : 12.7480,
    ];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      maxPitch: 85,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
          'satellite-tiles': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
          },
          'topo-tiles': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
          },
          'terrain-dem': {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
          'hillshade-dem': {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
          'gis-province': {
            type: 'geojson',
            data: '/oriental-mindoro.geojson',
          },
          'gis-municipality': {
            type: 'geojson',
            data: '/bongabong.geojson',
          },
          'gis-barangays': {
            type: 'geojson',
            data: '/bongabong-barangays.geojson',
          },
          'quarry-data': {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          },
          'checkpoint-data': {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          },
          'quarry-gis-detail': {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          },
        },
        layers: [
          { id: 'offline-background', type: 'background', paint: { 'background-color': '#E7EFE9' } },
          { id: 'base-street', type: 'raster', source: 'osm-tiles', layout: { visibility: 'visible' } },
          { id: 'base-satellite', type: 'raster', source: 'satellite-tiles', layout: { visibility: 'none' } },
          { id: 'base-topo', type: 'raster', source: 'topo-tiles', layout: { visibility: 'none' } },
          { id: 'hills', type: 'hillshade', source: 'hillshade-dem', layout: { visibility: 'visible' }, paint: { 'hillshade-exaggeration': 0.6 } },
          {
            id: 'gis-province-fill',
            type: 'fill',
            source: 'gis-province',
            paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.08 },
          },
          {
            id: 'gis-province-line',
            type: 'line',
            source: 'gis-province',
            paint: { 'line-color': '#64748b', 'line-width': 1, 'line-opacity': 0.5 },
          },
          {
            id: 'gis-municipality-fill',
            type: 'fill',
            source: 'gis-municipality',
            paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.1 },
          },
          {
            id: 'gis-municipality-casing',
            type: 'line',
            source: 'gis-municipality',
            paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.95 },
          },
          {
            id: 'gis-municipality-line',
            type: 'line',
            source: 'gis-municipality',
            paint: {
              'line-color': '#F97316',
              'line-width': 4,
              'line-opacity': 1,
              'line-dasharray': [2, 1],
            },
          },
          {
            id: 'gis-brgy-fill',
            type: 'fill',
            source: 'gis-barangays',
            paint: { 'fill-color': '#14b8a6', 'fill-opacity': 0.04 },
          },
          {
            id: 'gis-brgy-line',
            type: 'line',
            source: 'gis-barangays',
            paint: { 'line-color': '#0F766E', 'line-width': 0.8, 'line-opacity': 0.5 },
          },
          {
            id: 'quarry-poly-fill',
            type: 'fill',
            source: 'quarry-data',
            filter: ['==', ['get', 'type_name'], 'Polygon'],
            paint: {
              'fill-color': ['coalesce', ['get', 'color'], '#0F766E'],
              'fill-opacity': 0.2,
            },
          },
          {
            id: 'quarry-poly-line-casing',
            type: 'line',
            source: 'quarry-data',
            filter: ['==', ['get', 'type_name'], 'Polygon'],
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 7,
              'line-opacity': 0.95,
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
          },
          {
            id: 'quarry-poly-line',
            type: 'line',
            source: 'quarry-data',
            filter: ['==', ['get', 'type_name'], 'Polygon'],
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#0F766E'],
              'line-width': 3.5,
            },
          },
          {
            id: 'quarry-boundary-points-halo',
            type: 'circle',
            source: 'quarry-data',
            filter: ['==', ['get', 'type_name'], 'BoundaryPoint'],
            paint: {
              'circle-color': '#FFFFFF',
              'circle-radius': 8,
              'circle-opacity': 0.95,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(15, 23, 42, 0.25)',
            },
          },
          {
            id: 'quarry-boundary-points',
            type: 'circle',
            source: 'quarry-data',
            filter: ['==', ['get', 'type_name'], 'BoundaryPoint'],
            paint: {
              'circle-color': ['coalesce', ['get', 'color'], '#0F766E'],
              'circle-radius': 5,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#FFFFFF',
            },
          },
          {
            id: 'quarry-marker',
            type: 'circle',
            source: 'quarry-data',
            filter: ['==', ['get', 'type_name'], 'Point'],
            paint: { 'circle-color': '#0F766E', 'circle-radius': 9, 'circle-stroke-width': 3, 'circle-stroke-color': '#FFFFFF' },
          },
          // ── Detailed GIS Layers ──
          {
            id: 'gis-detail-fill',
            type: 'fill',
            source: 'quarry-gis-detail',
            filter: ['==', '$type', 'Polygon'],
            paint: {
              'fill-color': ['coalesce', ['get', 'color'], '#0ea5e9'],
              'fill-opacity': 0.65,
            },
          },
          {
            id: 'gis-detail-line',
            type: 'line',
            source: 'quarry-gis-detail',
            filter: ['==', '$type', 'Polygon'],
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#0369a1'],
              'line-width': 2,
            },
          },
          {
            id: 'gis-detail-roads',
            type: 'line',
            source: 'quarry-gis-detail',
            filter: ['==', '$type', 'LineString'],
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#b45309'],
              'line-width': 3.5,
              'line-dasharray': [2, 1],
            },
          },
          {
            id: 'gis-detail-points',
            type: 'circle',
            source: 'quarry-gis-detail',
            filter: ['==', '$type', 'Point'],
            paint: {
              'circle-color': ['coalesce', ['get', 'color'], '#6366f1'],
              'circle-radius': 8,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#FFFFFF',
            },
          },
          {
            id: 'gis-detail-extrusion',
            type: 'fill-extrusion',
            source: 'quarry-gis-detail',
            layout: { visibility: 'none' },
            filter: ['==', '$type', 'Polygon'],
            paint: {
              'fill-extrusion-color': ['coalesce', ['get', 'color'], '#0ea5e9'],
              'fill-extrusion-height': ['coalesce', ['get', 'extrusion_height'], ['get', 'elevation'], 2],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.85,
            },
          },
          {
            id: 'checkpoint-pulse',
            type: 'circle',
            source: 'checkpoint-data',
            paint: {
              'circle-color': ['match', ['get', 'status'], 'active', '#2563EB', '#94A3B8'],
              'circle-radius': 14,
              'circle-opacity': 0.2,
            },
          },
          {
            id: 'checkpoint-markers',
            type: 'circle',
            source: 'checkpoint-data',
            paint: {
              'circle-color': ['match', ['get', 'status'], 'active', '#2563EB', '#94A3B8'],
              'circle-radius': 7,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#FFFFFF',
            },
          },
        ],
      },
      center: center,
      zoom: 14,
      pitch: 60,
      bearing: -15,
    });

    mapInstanceRef.current = map;
    setMapObj(map);
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    // Populate local GeoJSON sources as soon as the style exists. Waiting for
    // the full `load` event also waits for remote raster/terrain requests and
    // can leave production maps without their boundary layers indefinitely.
    map.once('style.load', () => {
      try {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
      } catch (e) {}
      map.moveLayer('gis-municipality-casing');
      map.moveLayer('gis-municipality-line');
      // Detailed GIS layers are declared later in the style; move surveyed
      // boundary corners above them so the markers are never covered.
      map.moveLayer('quarry-poly-line-casing');
      map.moveLayer('quarry-poly-line');
      map.moveLayer('quarry-boundary-points-halo');
      map.moveLayer('quarry-boundary-points');

      const features = [];
      const aiAnalysis = quarry.ai_terrain_analysis;
      const aiColor = aiAnalysis?.color || '#0F766E';

      if (quarry.longitude && quarry.latitude) {
        const lng = parseFloat(quarry.longitude);
        const lat = parseFloat(quarry.latitude);
        if (!isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0) {
          const color = statusColors[quarry.status] || '#0F766E';

          const el = document.createElement('div');
          el.className = 'quarry-marker-wrapper';
          el.style.cursor = 'pointer';

          const pin = document.createElement('div');
          pin.style.cssText = `
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            background: ${color};
            border: 3px solid #ffffff;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
          `;

          const label = document.createElement('span');
          label.style.cssText = `
            transform: rotate(45deg);
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            font-family: Inter, system-ui, sans-serif;
          `;
          label.textContent = (quarry.name || '').charAt(0).toUpperCase() || 'Q';

          pin.appendChild(label);
          el.appendChild(pin);

          new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(map);
        }
      }

      // Handle polygon coordinates (parse if JSON string)
      let rawPoly = quarry.polygon_coordinates;
      if (typeof rawPoly === 'string') {
        try { rawPoly = JSON.parse(rawPoly); } catch (e) { rawPoly = null; }
      }

      if (rawPoly && Array.isArray(rawPoly) && rawPoly.length >= 3) {
        const polyCoords = rawPoly.map(pt => [parseFloat(pt[1]), parseFloat(pt[0])]);
        // Close linear ring if needed
        if (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] || polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1]) {
          polyCoords.push(polyCoords[0]);
        }

        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [polyCoords] },
          properties: {
            name: quarry.name,
            type_name: 'Polygon',
            color: aiColor,
            grade: aiAnalysis?.grade || 'GREEN',
          },
        });

        const boundaryPoints = polyCoords.slice(0, -1);
        boundaryLineCleanup = createMapBoundaryOverlay(
          map,
          [...boundaryPoints, boundaryPoints[0]],
          aiColor,
        );
        boundaryPoints.forEach((coordinates, index) => {
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates },
            properties: {
              name: quarry.name,
              point_number: index + 1,
              point_total: boundaryPoints.length,
              type_name: 'BoundaryPoint',
              color: aiColor,
            },
          });

          const markerElement = document.createElement('button');
          markerElement.type = 'button';
          markerElement.setAttribute('aria-label', `${quarry.name} boundary point ${index + 1}`);
          markerElement.title = `${quarry.name} — boundary point ${index + 1}`;
          markerElement.style.cssText = `
            width: 15px;
            height: 15px;
            min-width: 15px;
            min-height: 15px;
            padding: 0;
            border: 2.5px solid #ffffff;
            border-radius: 50%;
            background: ${aiColor};
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.5);
            cursor: pointer;
            pointer-events: auto;
            touch-action: manipulation;
            appearance: none;
            z-index: 3;
          `;

          const popupContent = document.createElement('div');
          popupContent.className = 'map-marker-popup';
          const popupTitle = document.createElement('strong');
          popupTitle.textContent = quarry.name || 'Quarry boundary';
          const popupPoint = document.createElement('span');
          popupPoint.textContent = `Boundary point ${index + 1} of ${boundaryPoints.length}`;
          popupContent.append(popupTitle, popupPoint);

          const boundaryMarker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
            .setLngLat(coordinates)
            .setPopup(new maplibregl.Popup({ offset: 14, closeButton: true }).setDOMContent(popupContent))
            .addTo(map);
          boundaryDomMarkers.push(boundaryMarker);
        });

        // Fit map bounds to polygon box
        let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
        polyCoords.forEach(([lng, lat]) => {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });

        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
          padding: 80,
          maxZoom: 16,
          pitch: 50,
          duration: 1200,
        });
      }

      const source = map.getSource('quarry-data');
      if (source) source.setData({ type: 'FeatureCollection', features });

      const handleBoundaryPointClick = (event) => {
        const properties = event.features?.[0]?.properties;
        if (!properties) return;

        const content = document.createElement('div');
        content.className = 'map-marker-popup';
        const title = document.createElement('strong');
        title.textContent = properties.name || 'Quarry boundary';
        const point = document.createElement('span');
        point.textContent = `Boundary point ${properties.point_number} of ${properties.point_total}`;
        content.append(title, point);

        new maplibregl.Popup({ offset: 10, closeButton: true })
          .setLngLat(event.lngLat)
          .setDOMContent(content)
          .addTo(map);
      };

      map.on('click', 'quarry-boundary-points', handleBoundaryPointClick);
      map.on('mouseenter', 'quarry-boundary-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'quarry-boundary-points', () => { map.getCanvas().style.cursor = ''; });

      const checkpointFeatures = checkpoints.map((checkpoint) => {
        const longitude = Number(checkpoint.longitude);
        const latitude = Number(checkpoint.latitude);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [longitude, latitude] },
          properties: {
            id: checkpoint.id,
            name: checkpoint.name || 'Checkpoint',
            address: checkpoint.address || 'No address provided',
            status: checkpoint.is_active ? 'active' : 'inactive',
          },
        };
      }).filter(Boolean);
      map.getSource('checkpoint-data')?.setData({ type: 'FeatureCollection', features: checkpointFeatures });

      const handleCheckpointClick = (event) => {
        const properties = event.features?.[0]?.properties;
        if (!properties) return;

        const content = document.createElement('div');
        content.style.cssText = 'font-family:Inter,system-ui,sans-serif;padding:6px 8px;min-width:190px;';
        const title = document.createElement('strong');
        title.style.cssText = 'display:block;color:#1e3a8a;font-size:0.9rem;margin-bottom:4px;';
        title.textContent = properties.name || 'Checkpoint';
        const address = document.createElement('div');
        address.style.cssText = 'color:#64748b;font-size:0.75rem;line-height:1.4;';
        address.textContent = properties.address || 'No address provided';
        const status = document.createElement('span');
        status.style.cssText = `display:inline-block;margin-top:7px;padding:2px 8px;border-radius:999px;font-size:0.68rem;font-weight:700;background:${properties.status === 'active' ? '#dbeafe' : '#f1f5f9'};color:${properties.status === 'active' ? '#1d4ed8' : '#64748b'};`;
        status.textContent = properties.status === 'active' ? 'ACTIVE CHECKPOINT' : 'INACTIVE CHECKPOINT';
        content.append(title, address, status);

        new maplibregl.Popup({ offset: 12, closeButton: true })
          .setLngLat(event.lngLat)
          .setDOMContent(content)
          .addTo(map);
      };

      map.on('click', 'checkpoint-markers', handleCheckpointClick);
      map.on('mouseenter', 'checkpoint-markers', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'checkpoint-markers', () => { map.getCanvas().style.cursor = ''; });

      // Load detailed GIS file if available (e.g. for Quarry #1)
      const loadGisData = async () => {
        try {
          let gisData = null;
          // Try API first
          try {
            const res = await getQuarryGisFile(quarry.id);
            if (res.data) gisData = res.data;
          } catch (e) {
            // Fallback to static GeoJSON if available
            if ([1, 3].includes(Number(quarry.id)) || ['quarry_1.geojson', 'quarry_3.geojson'].includes(quarry.gis_file_name)) {
              const res = await fetch(`/quarry_${quarry.id}.geojson`);
              if (res.ok) gisData = await res.json();
            }
          }

          if (gisData && map.getSource('quarry-gis-detail')) {
            map.getSource('quarry-gis-detail').setData(gisData);
            const featCount = gisData.features?.length || 1;
            setGisDetailInfo({ name: quarry.name, count: featCount });
          }
        } catch (err) {
          console.warn('Could not load detailed GIS file:', err);
        }
      };
      loadGisData();

      // Click on detailed GIS features for popup
      const handleGisClick = (e) => {
        if (!e.features || !e.features.length) return;
        const feat = e.features[0];
        const props = feat.properties || {};

        new maplibregl.Popup({ offset: 12, closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:6px 8px;min-width:200px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${props.color || '#0ea5e9'};"></span>
                <strong style="font-size:0.9rem;color:#0f172a;">${props.name || 'Operational Zone'}</strong>
              </div>
              <div style="font-size:0.75rem;color:#64748b;margin-bottom:4px;">
                Type: <strong style="color:#334155;">${props.type || 'Zone'}</strong>
              </div>
              ${props.elevation !== undefined ? `
                <div style="font-size:0.75rem;color:#64748b;margin-bottom:4px;">
                  Elevation / Depth: <strong style="color:${Number(props.elevation) < 0 ? '#ef4444' : '#10b981'};">${Number(props.elevation) > 0 ? '+' : ''}${props.elevation}m</strong>
                </div>` : ''}
              ${props.status ? `
                <span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:0.68rem;font-weight:700;background:#ecfdf5;color:#047857;">
                  ${props.status}
                </span>` : ''}
              ${props.reading ? `
                <div style="font-size:0.75rem;color:#6366f1;font-weight:600;margin-top:4px;">
                  Telemetry: ${props.reading}
                </div>` : ''}
              ${props.description ? `
                <p style="margin:6px 0 0;font-size:0.75rem;color:#475569;line-height:1.35;border-top:1px solid #f1f5f9;padding-top:4px;">
                  ${props.description}
                </p>` : ''}
            </div>
          `)
          .addTo(map);
      };

      ['gis-detail-fill', 'gis-detail-points', 'gis-detail-roads'].forEach((layerId) => {
        map.on('click', layerId, handleGisClick);
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });
    });

    return () => {
      boundaryLineCleanup();
      boundaryDomMarkers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, [quarry, checkpoints]);

  // Sync 3D extrusion vs 2D fill when is3D changes
  useEffect(() => {
    const m = mapInstanceRef.current;
    if (!m || !m.isStyleLoaded()) return;
    try {
      if (is3D) {
        if (m.getLayer('gis-detail-extrusion')) m.setLayoutProperty('gis-detail-extrusion', 'visibility', 'visible');
        if (m.getLayer('gis-detail-fill')) m.setLayoutProperty('gis-detail-fill', 'visibility', 'none');
      } else {
        if (m.getLayer('gis-detail-extrusion')) m.setLayoutProperty('gis-detail-extrusion', 'visibility', 'none');
        if (m.getLayer('gis-detail-fill')) m.setLayoutProperty('gis-detail-fill', 'visibility', 'visible');
      }
    } catch (e) {}
  }, [is3D]);

  if (loading) {
    return <div className="loader-container" style={{ padding: 80 }}><div className="spinner" /></div>;
  }

  if (!quarry) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <h3>Quarry not found</h3>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>Back to Map</Link>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 64px)' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      <div className="map-primary-controls quarry-detail-controls" style={{ position: 'absolute', top: 16, left: 16, zIndex: 100, display: 'flex', gap: 10 }}>
        <Link to="/" className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}>
          <ArrowLeft size={16} /> <span>Back to Map</span>
        </Link>
        <MapLayerControl map={mapObj} mapRef={mapInstanceRef} is3D={is3D} setIs3D={setIs3D} />
      </div>

      {/* Active GIS File Floating Notification Pill */}
      {gisDetailInfo && (
        <div className="map-gis-status" style={{
          position: 'absolute', bottom: 24, left: 16, zIndex: 90,
          background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(10px)',
          color: '#ffffff', padding: '8px 16px', borderRadius: 99,
          fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.18)',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }}></span>
          <span>GIS Site Plan Active: <strong style={{ color: '#38BDF8' }}>{gisDetailInfo.name}</strong> ({gisDetailInfo.count} Zones)</span>
        </div>
      )}

      <div className="map-utility-stack" style={{ position: 'absolute', bottom: 24, right: 16, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <MapControlsToolbar>
          <GeolocationControl map={mapObj} />
          <FullscreenControl map={mapObj} />
        </MapControlsToolbar>
        <CoordinateDisplay map={mapObj} />
        <ScaleBar map={mapObj} />
      </div>

      <div className="map-checkpoint-count" style={{ position: 'absolute', bottom: gisDetailInfo ? 72 : 24, left: 16, zIndex: 89, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', borderRadius: 99, padding: '7px 12px', boxShadow: '0 4px 14px rgba(15,23,42,0.14)', display: 'flex', alignItems: 'center', gap: 7, color: '#334155', fontSize: '0.75rem', fontWeight: 600 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', border: '2px solid #FFFFFF', boxShadow: '0 0 0 2px rgba(37,99,235,0.2)', display: 'inline-block' }} />
        {checkpoints.length} Checkpoint{checkpoints.length === 1 ? '' : 's'}
      </div>

      {/* Details Card Overlay */}
      {cardCollapsed ? (
        <button
          type="button"
          onClick={() => setCardCollapsed(false)}
          className="landing-sidebar-toggle-btn"
          title="Expand Quarry Details"
          style={{
            position: 'absolute',
            top: 16, right: 16,
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            cursor: 'pointer',
            color: '#0F766E',
            fontWeight: 600,
            fontSize: '0.85rem',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: 6, background: '#0F766E',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <MapPin size={15} />
          </div>
          <span>{quarry.name} Details</span>
          <ChevronLeft size={16} style={{ color: '#64748b' }} />
        </button>
      ) : (
        <div className="quarry-detail-panel" style={{
          position: 'absolute', top: 16, right: 16,
          width: 'calc(100% - 32px)', maxWidth: 360,
          background: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(12px)',
          borderRadius: 14, padding: 20, boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
          zIndex: 90, border: '1px solid rgba(255,255,255,0.5)',
          transition: 'all 0.25s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: 700, color: '#0F766E' }}>{quarry.name}</h2>
              <span style={{
                fontSize: '0.75rem', fontWeight: 600, padding: '3px 9px', borderRadius: 99,
                background: quarry.status === 'active' ? '#CCFBF1' : '#F3F4F6',
                color: statusColors[quarry.status] || '#4B5563',
              }}>
                {quarry.status.toUpperCase()}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCardCollapsed(true)}
              className="btn-ghost btn-icon"
              title="Collapse details panel"
              style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >
              <ChevronRight size={18} style={{ color: '#64748b' }} />
            </button>
          </div>

          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={16} className="text-teal-600" /> {quarry.address || 'Bongabong, Oriental Mindoro'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
              <span className="text-muted flex items-center gap-1"><FileText size={14} /> Permit No:</span>
              <span className="font-medium">{quarry.permit_number || 'N/A'}</span>
            </div>

            {quarry.permit_expires_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
                <span className="text-muted flex items-center gap-1"><Calendar size={14} /> Permit Status:</span>
                {quarry.permit_status === 'expired' ? (
                  <span className="badge badge-danger" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> Expired ({quarry.permit_expires_at})
                  </span>
                ) : quarry.permit_status === 'expiring_soon' ? (
                  <span className="badge badge-warning" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> Expiring ({quarry.days_until_permit_expiration}d left)
                  </span>
                ) : quarry.permit_status === 'not_started' ? (
                  <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                    Starts {quarry.permit_issued_at}
                  </span>
                ) : (
                  <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                    Valid until {quarry.permit_expires_at}
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
              <span className="text-muted flex items-center gap-1"><Ruler size={14} /> Area:</span>
              <span className="font-medium">{quarry.area_hectares ? `${quarry.area_hectares} hectares` : 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
              <span className="text-muted flex items-center gap-1"><ShieldCheck size={14} /> Location Coordinates:</span>
              <span className="font-medium">{quarry.latitude && quarry.longitude ? `${parseFloat(quarry.latitude).toFixed(4)}, ${parseFloat(quarry.longitude).toFixed(4)}` : 'N/A'}</span>
            </div>
          </div>

          {quarry.description && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#334155' }}>Description</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>{quarry.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
