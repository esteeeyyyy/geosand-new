import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { createQuarry, getQuarries, getQuarryGisFile } from '../../api/quarries';
import { approveOperatorApplication, getOperatorApplications } from '../../api/operatorApplications';
import { getCheckpoints } from '../../api/checkpoints';
import { createMapBoundaryOverlay } from '../../utils/mapBoundaryOverlay';
import { Mountain, MapPin, Search, X, ChevronLeft, ChevronRight, Building2, Plus, Trash2, FileText, ArrowRight, Save } from 'lucide-react';
import { MapLayerControl } from '../../components/MapLayerToggle';
import { GeolocationControl, FullscreenControl, ScaleBar, CoordinateDisplay, MapControlsToolbar, calcPolygonArea } from '../../components/MapControls';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import SearchableSelect from '../../components/SearchableSelect';

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const statusColors = {
  active: '#0F766E',
  pending: '#F59E0B',
  inactive: '#9CA3AF',
  suspended: '#D97706',
  illegal: '#DC2626',
};

export default function Landing() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [quarries, setQuarries] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const { openOperatorModal } = useOutletContext() || {};
  const [is3D, setIs3D] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [activeGisInfo, setActiveGisInfo] = useState(null);
  const [applicationPickerOpen, setApplicationPickerOpen] = useState(false);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [quarryDraftMode, setQuarryDraftMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState([{ id: 1, latitude: '', longitude: '' }]);
  const [savingQuarry, setSavingQuarry] = useState(false);
  const [quarryDetails, setQuarryDetails] = useState({
    name: '',
    address: '',
    permit_number: '',
    permit_expires_at: '',
    annual_allowable_volume_cubic_meters: '',
  });

  const quarryDraftModeRef = useRef(false);
  useEffect(() => {
    quarryDraftModeRef.current = quarryDraftMode;
  }, [quarryDraftMode]);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapObj, setMapObj] = useState(null);
  const popupRef = useRef(null);
  // Stores DOM marker instances for cleanup
  const markersRef = useRef([]);
  const checkpointMarkersRef = useRef([]);
  const boundaryMarkersRef = useRef([]);
  const boundaryMarkerQuarryIdRef = useRef(null);
  const boundaryLineCleanupRef = useRef(null);
  const gisCacheRef = useRef({});
  const currentLoadedGisId = useRef(null);
  const quarriesRef = useRef([]);
  const nextDraftPointId = useRef(2);
  const lastPreviewCountRef = useRef(0);

  const center = [121.4892, 12.7480]; // Bongabong, Oriental Mindoro centroid

  // Keep quarriesRef synced for map event callbacks
  useEffect(() => {
    quarriesRef.current = quarries;
  }, [quarries]);

  // Pre-load detailed QGIS-compatible layers for featured quarries.
  useEffect(() => {
    [1, 3].forEach((quarryId) => {
      fetch(`/quarry_${quarryId}.geojson`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) gisCacheRef.current[quarryId] = data;
        })
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const requested = searchParams.get('addQuarry') === 'application';
    const requestedApplicationId = searchParams.get('applicationId');
    if (!requested || authLoading) return;

    if (user?.role !== 'admin') {
      toast.error('Administrator access is required to add a quarry');
      navigate('/', { replace: true });
      return;
    }

    setApplicationPickerOpen(true);
    setApplicationsLoading(true);
    getOperatorApplications({ status: 'pending', per_page: 100 })
      .then((response) => {
        const applications = response.data.applications || [];
        const requestedApplication = applications.find((application) => String(application.id) === requestedApplicationId);
        setPendingApplications(applications);
        setSelectedApplicationId(requestedApplication
          ? String(requestedApplication.id)
          : applications[0] ? String(applications[0].id) : '');
      })
      .catch(() => toast.error('Pending operator applications could not be loaded'))
      .finally(() => setApplicationsLoading(false));
  }, [authLoading, location.search, navigate, user?.role]);

  useEffect(() => {
    // Fetch all quarry sites and checkpoints for the map.
    Promise.all([
      getQuarries({ per_page: 100 }),
      getCheckpoints({ per_page: 100 }).catch(() => ({ data: { checkpoints: [] } })),
    ])
      .then(([quarryResponse, checkpointResponse]) => {
        setQuarries(quarryResponse.data.quarries || []);
        setCheckpoints(checkpointResponse.data.checkpoints || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // MapLibre Map Instance
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
            attribution: '© OpenStreetMap contributors',
          },
          'satellite-tiles': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Esri World Imagery',
          },
          'topo-tiles': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Esri World Topo',
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
          'quarry-locations': {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          },
          'selected-quarry-boundary': {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          },
          'quarry-draft': {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          },
          'checkpoint-locations': {
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
          // Base Layers
          {
            id: 'offline-background',
            type: 'background',
            paint: { 'background-color': '#E7EFE9' },
          },
          {
            id: 'base-street',
            type: 'raster',
            source: 'osm-tiles',
            layout: { visibility: 'visible' },
          },
          {
            id: 'base-satellite',
            type: 'raster',
            source: 'satellite-tiles',
            layout: { visibility: 'none' },
          },
          {
            id: 'base-topo',
            type: 'raster',
            source: 'topo-tiles',
            layout: { visibility: 'none' },
          },
          // 3D Hillshade Terrain relief layer (active only in 3D mode)
          {
            id: 'hills',
            type: 'hillshade',
            source: 'hillshade-dem',
            layout: { visibility: 'visible' },
            paint: {
              'hillshade-exaggeration': 0.6,
              'hillshade-shadow-color': '#1e293b',
            },
          },
          // GIS Boundary Layers
          {
            id: 'gis-province-fill',
            type: 'fill',
            source: 'gis-province',
            paint: {
              'fill-color': '#94a3b8',
              'fill-opacity': 0.08,
            },
          },
          {
            id: 'gis-province-line',
            type: 'line',
            source: 'gis-province',
            paint: {
              'line-color': '#64748b',
              'line-width': 1,
              'line-opacity': 0.5,
            },
          },
          {
            id: 'gis-municipality-fill',
            type: 'fill',
            source: 'gis-municipality',
            paint: {
              'fill-color': '#F59E0B',
              'fill-opacity': 0.1,
            },
          },
          {
            id: 'gis-municipality-casing',
            type: 'line',
            source: 'gis-municipality',
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 7,
              'line-opacity': 0.95,
            },
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
            paint: {
              'fill-color': '#14b8a6',
              'fill-opacity': 0.04,
            },
          },
          {
            id: 'gis-brgy-line',
            type: 'line',
            source: 'gis-barangays',
            paint: {
              'line-color': '#0F766E',
              'line-width': 0.8,
              'line-opacity': 0.5,
            },
          },
          // Quarry Points & Polygons
          {
            id: 'quarries-polygons-fill',
            type: 'fill',
            source: 'quarry-locations',
            filter: ['==', ['get', 'type_name'], 'Polygon'],
            paint: {
              'fill-color': [
                'match', ['get', 'status'],
                'active', '#0F766E',
                'suspended', '#D97706',
                '#9CA3AF'
              ],
              'fill-opacity': 0.25,
            },
          },
          {
            id: 'quarries-polygons-outline',
            type: 'line',
            source: 'quarry-locations',
            filter: ['==', ['get', 'type_name'], 'Polygon'],
            paint: {
              'line-color': [
                'match', ['get', 'status'],
                'active', '#0F766E',
                'suspended', '#D97706',
                '#9CA3AF'
              ],
              'line-width': 2,
            },
          },
          {
            id: 'quarries-boundary-points-halo',
            type: 'circle',
            source: 'quarry-locations',
            minzoom: 11.5,
            filter: ['==', ['get', 'type_name'], 'BoundaryPoint'],
            paint: {
              'circle-color': '#FFFFFF',
              'circle-radius': 7,
              'circle-opacity': 0.95,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(15, 23, 42, 0.25)',
            },
          },
          {
            id: 'quarries-boundary-points',
            type: 'circle',
            source: 'quarry-locations',
            minzoom: 11.5,
            filter: ['==', ['get', 'type_name'], 'BoundaryPoint'],
            paint: {
              'circle-color': [
                'match', ['get', 'status'],
                'active', '#0F766E',
                'suspended', '#D97706',
                '#64748B'
              ],
              'circle-radius': 4.5,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#FFFFFF',
            },
          },
          {
            id: 'quarries-points',
            type: 'circle',
            source: 'quarry-locations',
            filter: ['==', ['get', 'type_name'], 'Point'],
            paint: {
              'circle-color': [
                'match', ['get', 'status'],
                'active', '#0F766E',
                'suspended', '#D97706',
                '#9CA3AF'
              ],
              'circle-radius': 9,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#FFFFFF',
            },
          },
          {
            id: 'quarry-draft-fill',
            type: 'fill',
            source: 'quarry-draft',
            filter: ['==', '$type', 'Polygon'],
            paint: {
              'fill-color': '#2563EB',
              'fill-opacity': 0.25,
            },
          },
          {
            id: 'quarry-draft-line',
            type: 'line',
            source: 'quarry-draft',
            filter: ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
            paint: {
              'line-color': '#2563EB',
              'line-width': 3,
              'line-dasharray': [2, 1],
            },
          },
          {
            id: 'quarry-draft-points',
            type: 'circle',
            source: 'quarry-draft',
            filter: ['==', '$type', 'Point'],
            paint: {
              'circle-color': '#2563EB',
              'circle-radius': 7,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#FFFFFF',
            },
          },
          // ── Detailed GIS Layers (Active when zoomed in to quarry polygon: minzoom 13.5) ──
          {
            id: 'gis-detail-fill',
            type: 'fill',
            source: 'quarry-gis-detail',
            minzoom: 13.5,
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
            minzoom: 13.5,
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
            minzoom: 13.5,
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
            minzoom: 13.5,
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
            minzoom: 13.5,
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
            id: 'selected-quarry-boundary-casing',
            type: 'line',
            source: 'selected-quarry-boundary',
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
            id: 'selected-quarry-boundary-line',
            type: 'line',
            source: 'selected-quarry-boundary',
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#0F766E'],
              'line-width': 3.5,
              'line-opacity': 1,
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
          },
          {
            id: 'checkpoint-pulse',
            type: 'circle',
            source: 'checkpoint-locations',
            paint: {
              'circle-color': ['match', ['get', 'status'], 'active', '#2563EB', '#94A3B8'],
              'circle-radius': 14,
              'circle-opacity': 0.2,
            },
          },
          {
            id: 'checkpoint-markers',
            type: 'circle',
            source: 'checkpoint-locations',
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
      zoom: 11,
      pitch: 0,
    });

    mapInstanceRef.current = map;
    // DOM markers do not depend on tile downloads. Publish the map instance
    // immediately so slow terrain/GIS sources cannot leave the map looking bare.
    setMapObj(map);
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');

    // MapLibre can retain its desktop canvas dimensions when a mobile browser
    // changes its visual viewport. Keep the canvas and marker projection synced.
    const resizeMap = () => map.resize();
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resizeMap)
      : null;
    resizeObserver?.observe(mapContainerRef.current);
    window.addEventListener('orientationchange', resizeMap);
    requestAnimationFrame(resizeMap);

    // Layer interactions only need the style definition to be ready; waiting for
    // every tile/source to load can hang indefinitely on a mobile connection.
    map.once('style.load', () => {
      // Keep the municipal outline above fills, terrain, and barangay lines.
      // Its white casing makes the boundary readable on both street and
      // satellite basemaps.
      map.moveLayer('gis-municipality-casing');
      map.moveLayer('gis-municipality-line');

      // Keep quarry boundary vertices above detailed GIS fills and terrain
      // overlays so the surveyed corners remain visible on small screens.
      map.moveLayer('quarries-polygons-outline');
      map.moveLayer('selected-quarry-boundary-casing');
      map.moveLayer('selected-quarry-boundary-line');
      map.moveLayer('quarries-boundary-points-halo');
      map.moveLayer('quarries-boundary-points');

      // Map click handler for adding/filling boundary points in draft mode
      map.on('click', (e) => {
        if (!quarryDraftModeRef.current) return;
        const lat = parseFloat(e.lngLat.lat.toFixed(6));
        const lng = parseFloat(e.lngLat.lng.toFixed(6));
        setDraftPoints((points) => {
          const last = points[points.length - 1];
          if (last && (last.latitude === '' || last.latitude === undefined) && (last.longitude === '' || last.longitude === undefined)) {
            return points.map((p, idx) => idx === points.length - 1 ? { ...p, latitude: String(lat), longitude: String(lng) } : p);
          }
          const id = nextDraftPointId.current++;
          return [...points, { id, latitude: String(lat), longitude: String(lng) }];
        });
      });

      // Click on outer quarry polygon boundary to zoom in & load its GIS file
      map.on('click', 'quarries-polygons-fill', (e) => {
        if (quarryDraftModeRef.current) return;
        if (!e.features || !e.features.length) return;
        const qId = e.features[0].properties?.id;
        const targetQ = quarriesRef.current.find((x) => x.id === qId);
        if (targetQ) {
          selectQuarry(targetQ);
        }
      });
      map.on('mouseenter', 'quarries-polygons-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'quarries-polygons-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      const handleBoundaryPointClick = (event) => {
        if (quarryDraftModeRef.current) return;
        const properties = event.features?.[0]?.properties;
        if (!properties) return;

        const quarry = quarriesRef.current.find((item) => Number(item.id) === Number(properties.quarry_id));
        if (quarry) setSelected(quarry);

        const content = document.createElement('div');
        content.className = 'map-marker-popup';
        const title = document.createElement('strong');
        title.textContent = properties.quarry_name || 'Quarry boundary';
        const point = document.createElement('span');
        point.textContent = `Boundary point ${properties.point_number} of ${properties.point_total}`;
        content.append(title, point);

        new maplibregl.Popup({ offset: 10, closeButton: true })
          .setLngLat(event.lngLat)
          .setDOMContent(content)
          .addTo(map);
      };

      map.on('click', 'quarries-boundary-points', handleBoundaryPointClick);
      map.on('mouseenter', 'quarries-boundary-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'quarries-boundary-points', () => { map.getCanvas().style.cursor = ''; });

      // Click on any detailed GIS feature (pit, stockpile, plant, road, sensor)
      const handleGisClick = (e) => {
        if (quarryDraftModeRef.current) return;
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

      map.on('click', 'checkpoint-markers', (event) => {
        if (quarryDraftModeRef.current) return;
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
      });
      map.on('mouseenter', 'checkpoint-markers', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'checkpoint-markers', () => { map.getCanvas().style.cursor = ''; });

      // Dynamic GIS file display on zoom: when zoom >= 13.5, detect visible quarry and render its GIS file
      const updateGisDetailsOnZoom = () => {
        const zoom = map.getZoom();
        if (zoom < 13.5) {
          const src = map.getSource('quarry-gis-detail');
          if (src) src.setData({ type: 'FeatureCollection', features: [] });
          map.getSource('selected-quarry-boundary')?.setData({ type: 'FeatureCollection', features: [] });
          boundaryLineCleanupRef.current?.();
          boundaryLineCleanupRef.current = null;
          boundaryMarkersRef.current.forEach((marker) => marker.remove());
          boundaryMarkersRef.current = [];
          boundaryMarkerQuarryIdRef.current = null;
          currentLoadedGisId.current = null;
          setActiveGisInfo(null);
          return;
        }

        const centerPt = map.getCenter();
        const nearestQ = findNearestQuarry(centerPt.lng, centerPt.lat, quarriesRef.current);
        if (nearestQ) {
          loadGisFileForQuarry(map, nearestQ);
        }
      };

      map.on('zoomend', updateGisDetailsOnZoom);
      map.on('moveend', updateGisDetailsOnZoom);
    });

    return () => {
      // Clean up markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      checkpointMarkersRef.current.forEach((marker) => marker.remove());
      checkpointMarkersRef.current = [];
      boundaryMarkersRef.current.forEach((marker) => marker.remove());
      boundaryMarkersRef.current = [];
      boundaryMarkerQuarryIdRef.current = null;
      boundaryLineCleanupRef.current?.();
      boundaryLineCleanupRef.current = null;
      resizeObserver?.disconnect();
      window.removeEventListener('orientationchange', resizeMap);
      map.remove();
    };
  }, []);

  // Helper: build and add markers + GeoJSON features from quarry data onto map
  const applyQuarriesToMap = (map, quarryList) => {
    if (!map || !quarryList) return;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const features = [];

    quarryList.forEach((q) => {
      let rawPoly = q.polygon_coordinates;
      if (typeof rawPoly === 'string') {
        try { rawPoly = JSON.parse(rawPoly); } catch (e) { rawPoly = null; }
      }

      const polyCoords = Array.isArray(rawPoly)
        ? rawPoly
          .map((pt) => [Number(pt?.[1]), Number(pt?.[0])])
          .filter(([polyLng, polyLat]) => Number.isFinite(polyLng) && Number.isFinite(polyLat))
        : [];

      let lng = Number(q.longitude);
      let lat = Number(q.latitude);

      // Some imported quarry records only contain a boundary. Use its center
      // so every valid quarry still receives a visible, tappable pin.
      if ((!Number.isFinite(lng) || !Number.isFinite(lat) || lng === 0 || lat === 0) && polyCoords.length >= 3) {
        const center = polyCoords.reduce(
          (sum, [polyLng, polyLat]) => [sum[0] + polyLng, sum[1] + polyLat],
          [0, 0],
        );
        lng = center[0] / polyCoords.length;
        lat = center[1] / polyCoords.length;
      }

      if (Number.isFinite(lng) && Number.isFinite(lat) && lng !== 0 && lat !== 0) {
        const color = statusColors[q.status] || '#0F766E';

        // 1. Add GeoJSON Point feature
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            id: q.id,
            name: q.name,
            status: q.status,
            address: q.address,
            type_name: 'Point',
          },
        });

        // 2. Add DOM Marker with outer wrapper so MapLibre transform does not overwrite pin rotation
        const el = document.createElement('div');
        el.className = 'quarry-marker-wrapper';
        el.style.cursor = 'pointer';
        el.style.pointerEvents = 'auto';
        el.style.touchAction = 'manipulation';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', `Open ${q.name || 'quarry'} details`);

        const pin = document.createElement('div');
        pin.style.cssText = `
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          background: ${color};
          border: 2.5px solid #ffffff;
          transform: rotate(-45deg);
          box-shadow: 0 3px 10px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        const label = document.createElement('span');
        label.style.cssText = `
          transform: rotate(45deg);
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          font-family: Inter, system-ui, sans-serif;
        `;
        label.textContent = (q.name || '').charAt(0).toUpperCase() || 'Q';

        pin.appendChild(label);
        el.appendChild(pin);

        const popupHTML = `
          <div style="font-family:Inter,sans-serif;padding:4px 6px;">
            <h4 style="margin:0 0 4px;font-size:0.9rem;font-weight:700;color:#0F766E;">${q.name}</h4>
            <p style="margin:0 0 6px;font-size:0.75rem;color:#64748b;">${q.address || ''}</p>
            <div style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:0.7rem;font-weight:600;background:${q.status === 'active' ? '#CCFBF1' : '#F3F4F6'};color:${q.status === 'active' ? '#0F766E' : '#4B5563'};">
              ${(q.status || '').toUpperCase()}
            </div>
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHTML))
          .addTo(map);

        markersRef.current.push(marker);
      }

      // GeoJSON for polygon boundaries
      if (polyCoords.length >= 3) {
        if (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] || polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1]) {
          polyCoords.push(polyCoords[0]);
        }
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [polyCoords] },
          properties: { id: q.id, name: q.name, status: q.status, type_name: 'Polygon' },
        });

        const boundaryPoints = polyCoords.slice(0, -1);
        boundaryPoints.forEach((coordinates, index) => {
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates },
            properties: {
              id: `${q.id}-boundary-${index + 1}`,
              quarry_id: q.id,
              quarry_name: q.name,
              status: q.status,
              point_number: index + 1,
              point_total: boundaryPoints.length,
              type_name: 'BoundaryPoint',
            },
          });
        });
      }
    });

    // Update GeoJSON source
    const source = map.getSource('quarry-locations');
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }
  };

  // Helper to find nearest quarry to center coordinates
  const findNearestQuarry = (lng, lat, list) => {
    if (!list || !list.length) return null;
    let closest = null;
    let minDist = Infinity;
    for (const q of list) {
      const qLng = parseFloat(q.longitude);
      const qLat = parseFloat(q.latitude);
      if (isNaN(qLng) || isNaN(qLat)) continue;
      const d = Math.hypot(qLng - lng, qLat - lat);
      if (d < 0.04 && d < minDist) {
        minDist = d;
        closest = q;
      }
    }
    return closest;
  };

  const renderQuarryBoundaryMarkers = (map, quarry) => {
    if (!map || !quarry || boundaryMarkerQuarryIdRef.current === quarry.id) return;

    boundaryMarkersRef.current.forEach((marker) => marker.remove());
    boundaryMarkersRef.current = [];
    boundaryMarkerQuarryIdRef.current = null;
    boundaryLineCleanupRef.current?.();
    boundaryLineCleanupRef.current = null;
    map.getSource('selected-quarry-boundary')?.setData({ type: 'FeatureCollection', features: [] });

    let rawPolygon = quarry.polygon_coordinates;
    if (typeof rawPolygon === 'string') {
      try { rawPolygon = JSON.parse(rawPolygon); } catch (error) { rawPolygon = null; }
    }

    const points = Array.isArray(rawPolygon)
      ? rawPolygon
        .map((point) => [Number(point?.[1]), Number(point?.[0])])
        .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude))
      : [];

    if (points.length < 3) return;

    const uniquePoints = points.length > 1
      && points[0][0] === points[points.length - 1][0]
      && points[0][1] === points[points.length - 1][1]
      ? points.slice(0, -1)
      : points;
    const color = statusColors[quarry.status] || '#0F766E';
    const closedBoundary = [...uniquePoints, uniquePoints[0]];

    map.getSource('selected-quarry-boundary')?.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: closedBoundary },
        properties: { quarry_id: quarry.id, quarry_name: quarry.name, color },
      }],
    });
    boundaryLineCleanupRef.current = createMapBoundaryOverlay(map, closedBoundary, color);

    uniquePoints.forEach((coordinates, index) => {
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
        background: ${color};
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
      popupPoint.textContent = `Boundary point ${index + 1} of ${uniquePoints.length}`;
      popupContent.append(popupTitle, popupPoint);

      const marker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
        .setLngLat(coordinates)
        .setPopup(new maplibregl.Popup({ offset: 14, closeButton: true }).setDOMContent(popupContent))
        .addTo(map);
      boundaryMarkersRef.current.push(marker);
    });

    boundaryMarkerQuarryIdRef.current = quarry.id;
  };

  // Helper to load GIS file GeoJSON into quarry-gis-detail source
  const loadGisFileForQuarry = async (m, q) => {
    if (!m || !q) return;
    renderQuarryBoundaryMarkers(m, q);
    if (currentLoadedGisId.current === q.id) return;

    if (gisCacheRef.current[q.id]) {
      const cached = gisCacheRef.current[q.id];
      currentLoadedGisId.current = q.id;
      const src = m.getSource('quarry-gis-detail');
      if (src) src.setData(cached);
      setActiveGisInfo({ name: q.name, count: cached.features?.length || 1 });
      return;
    }

    try {
      let data = null;
      try {
        const res = await getQuarryGisFile(q.id);
        if (res.data) data = res.data;
      } catch (e) {
        // Fallback to static GeoJSON or direct url
        const staticFallback = [1, 3].includes(Number(q.id)) ? `/quarry_${q.id}.geojson` : null;
        const fallbackUrl = staticFallback || q.gis_file_url;
        if (fallbackUrl) {
          const res = await fetch(fallbackUrl);
          if (res.ok) data = await res.json();
        }
      }

      if (data) {
        currentLoadedGisId.current = q.id;
        gisCacheRef.current[q.id] = data;
        const src = m.getSource('quarry-gis-detail');
        if (src) src.setData(data);
        setActiveGisInfo({ name: q.name, count: data.features?.length || 1 });
      } else {
        const src = m.getSource('quarry-gis-detail');
        if (src) src.setData({ type: 'FeatureCollection', features: [] });
        currentLoadedGisId.current = null;
        setActiveGisInfo(null);
      }
    } catch (err) {
      console.warn(`Could not load GIS file for quarry #${q.id}:`, err);
    }
  };

  // Apply quarry markers and polygons to map when data is ready
  useEffect(() => {
    if (!mapObj || quarries.length === 0) return undefined;

    const syncQuarries = () => applyQuarriesToMap(mapObj, quarries);
    syncQuarries();

    if (!mapObj.isStyleLoaded()) {
      mapObj.once('style.load', syncQuarries);
    }

    return () => mapObj.off('style.load', syncQuarries);
  }, [mapObj, quarries]);

  useEffect(() => {
    if (!mapObj) return undefined;

    const syncCheckpoints = () => {
      checkpointMarkersRef.current.forEach((marker) => marker.remove());
      checkpointMarkersRef.current = [];

      const features = checkpoints.map((checkpoint) => {
        const longitude = Number(checkpoint.longitude);
        const latitude = Number(checkpoint.latitude);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

        const feature = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [longitude, latitude] },
          properties: {
            id: checkpoint.id,
            name: checkpoint.name || 'Checkpoint',
            address: checkpoint.address || 'No address provided',
            status: checkpoint.is_active ? 'active' : 'inactive',
          },
        };

        // DOM pins remain visible and tappable on mobile browsers where dense
        // WebGL symbol/circle layers can be dropped during memory pressure.
        const markerElement = document.createElement('button');
        markerElement.type = 'button';
        markerElement.className = `checkpoint-marker-wrapper ${checkpoint.is_active ? 'active' : 'inactive'}`;
        markerElement.setAttribute('aria-label', `Checkpoint: ${checkpoint.name || 'Unnamed checkpoint'}`);
        markerElement.title = checkpoint.name || 'Checkpoint';

        const markerDot = document.createElement('span');
        markerDot.setAttribute('aria-hidden', 'true');
        markerElement.appendChild(markerDot);

        const popupContent = document.createElement('div');
        popupContent.className = 'map-marker-popup';
        const popupTitle = document.createElement('strong');
        popupTitle.textContent = checkpoint.name || 'Checkpoint';
        const popupAddress = document.createElement('span');
        popupAddress.textContent = checkpoint.address || 'No address provided';
        const popupStatus = document.createElement('small');
        popupStatus.textContent = checkpoint.is_active ? 'Active checkpoint' : 'Inactive checkpoint';
        popupContent.append(popupTitle, popupAddress, popupStatus);

        const marker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
          .setLngLat([longitude, latitude])
          .setPopup(new maplibregl.Popup({ offset: 18, closeButton: true }).setDOMContent(popupContent))
          .addTo(mapObj);
        checkpointMarkersRef.current.push(marker);

        return feature;
      }).filter(Boolean);

      mapObj.getSource('checkpoint-locations')?.setData({ type: 'FeatureCollection', features });
    };

    syncCheckpoints();

    if (!mapObj.isStyleLoaded()) {
      mapObj.once('style.load', syncCheckpoints);
    }

    return () => {
      mapObj.off('style.load', syncCheckpoints);
      checkpointMarkersRef.current.forEach((marker) => marker.remove());
      checkpointMarkersRef.current = [];
    };
  }, [mapObj, checkpoints]);

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

  // Center on selected quarry from search/sidebar & load its detailed GIS file
  const selectQuarry = (q) => {
    setSelected(q);
    const m = mapInstanceRef.current;
    if (!m) return;

    // Load GIS file immediately upon selection
    loadGisFileForQuarry(m, q);

    let rawPoly = q.polygon_coordinates;
    if (typeof rawPoly === 'string') {
      try { rawPoly = JSON.parse(rawPoly); } catch (e) { rawPoly = null; }
    }

    if (rawPoly && Array.isArray(rawPoly) && rawPoly.length >= 3) {
      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
      rawPoly.forEach(pt => {
        const lat = parseFloat(pt[0]);
        const lng = parseFloat(pt[1]);
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });

      m.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: 80,
        maxZoom: 16.5,
        pitch: is3D ? 58 : 0,
        duration: 1400,
      });
    } else if (q.longitude && q.latitude) {
      m.flyTo({
        center: [parseFloat(q.longitude), parseFloat(q.latitude)],
        zoom: 15.5,
        pitch: is3D ? 58 : 0,
        duration: 1500,
      });
    }
  };

  const filteredQuarries = quarries.filter((q) => {
    const matchSearch =
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      (q.address && q.address.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const selectedApplication = pendingApplications.find((application) => String(application.id) === selectedApplicationId) || null;

  const validDraftPoints = useMemo(() => draftPoints
    .map((point) => [
      point.latitude === '' ? Number.NaN : Number(point.latitude),
      point.longitude === '' ? Number.NaN : Number(point.longitude),
    ])
    .filter(([latitude, longitude]) => (
      Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90
      && longitude >= -180 && longitude <= 180
    )), [draftPoints]);

  useEffect(() => {
    if (!mapObj) return;
    const source = mapObj.getSource('quarry-draft');
    if (!source) return;

    if (!quarryDraftMode) {
      source.setData({ type: 'FeatureCollection', features: [] });
      lastPreviewCountRef.current = 0;
      return;
    }

    const features = validDraftPoints.map(([latitude, longitude], index) => ({
      type: 'Feature',
      properties: { point_number: index + 1 },
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
    }));

    if (validDraftPoints.length >= 3) {
      const ring = validDraftPoints.map(([latitude, longitude]) => [longitude, latitude]);
      ring.push(ring[0]);
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
    } else if (validDraftPoints.length === 2) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: validDraftPoints.map(([latitude, longitude]) => [longitude, latitude]) },
      });
    }

    source.setData({ type: 'FeatureCollection', features });

    if (validDraftPoints.length && lastPreviewCountRef.current !== validDraftPoints.length) {
      if (validDraftPoints.length === 1) {
        mapObj.flyTo({ center: [validDraftPoints[0][1], validDraftPoints[0][0]], zoom: 16, duration: 700 });
      } else {
        const bounds = new maplibregl.LngLatBounds();
        validDraftPoints.forEach(([latitude, longitude]) => bounds.extend([longitude, latitude]));
        mapObj.fitBounds(bounds, { padding: { top: 80, right: 390, bottom: 80, left: 80 }, maxZoom: 17, duration: 700 });
      }
    }
    lastPreviewCountRef.current = validDraftPoints.length;
  }, [mapObj, quarryDraftMode, validDraftPoints]);

  const beginCoordinateEntry = () => {
    if (!selectedApplication) {
      toast.error('Select a pending operator application first, or click Skip');
      return;
    }
    setQuarryDetails({
      name: selectedApplication.applicant_name || selectedApplication.company_name || '',
      address: selectedApplication.quarry_location || '',
      permit_number: selectedApplication.permit_number || '',
      permit_expires_at: '',
      annual_allowable_volume_cubic_meters: '',
    });
    setDraftPoints([{ id: 1, latitude: '', longitude: '' }]);
    nextDraftPointId.current = 2;
    setApplicationPickerOpen(false);
    setQuarryDraftMode(true);
    setSidebarCollapsed(false);
  };

  const skipApplicationSelection = () => {
    setSelectedApplicationId('');
    setQuarryDetails({
      name: '',
      address: '',
      permit_number: '',
      permit_expires_at: '',
      annual_allowable_volume_cubic_meters: '',
    });
    setDraftPoints([{ id: 1, latitude: '', longitude: '' }]);
    nextDraftPointId.current = 2;
    setApplicationPickerOpen(false);
    setQuarryDraftMode(true);
    setSidebarCollapsed(false);
  };

  const updateDraftPoint = (id, field, value) => {
    setDraftPoints((points) => points.map((point) => (point.id === id ? { ...point, [field]: value } : point)));
  };

  const addDraftPoint = () => {
    const id = nextDraftPointId.current++;
    setDraftPoints((points) => [...points, { id, latitude: '', longitude: '' }]);
  };

  const removeDraftPoint = (id) => {
    setDraftPoints((points) => points.length === 1 ? points : points.filter((point) => point.id !== id));
  };

  const cancelQuarryFlow = () => {
    setApplicationPickerOpen(false);
    setQuarryDraftMode(false);
    setSelectedApplicationId('');
    setQuarryDetails({
      name: '',
      address: '',
      permit_number: '',
      permit_expires_at: '',
      annual_allowable_volume_cubic_meters: '',
    });
    navigate('/', { replace: true });
  };

  const saveApplicationQuarry = async (event) => {
    event.preventDefault();

    const name = (quarryDetails.name || selectedApplication?.applicant_name || selectedApplication?.company_name || '').trim();
    if (!name) {
      toast.error('Please enter a quarry / permittee name');
      return;
    }

    if (validDraftPoints.length !== draftPoints.length) {
      toast.error('Enter a valid latitude and longitude for every point');
      return;
    }
    if (validDraftPoints.length < 3) {
      toast.error('Add at least three coordinate points to define the quarry boundary');
      return;
    }

    const latitude = validDraftPoints.reduce((sum, point) => sum + point[0], 0) / validDraftPoints.length;
    const longitude = validDraftPoints.reduce((sum, point) => sum + point[1], 0) / validDraftPoints.length;
    const applicationNote = selectedApplication
      ? `Created from operator application by ${selectedApplication.applicant_name}.`
      : 'Created directly by admin.';

    const description = selectedApplication?.remarks
      ? `${applicationNote} ${selectedApplication.remarks}`
      : applicationNote;

    const address = (quarryDetails.address || selectedApplication?.quarry_location || 'Bongabong, Oriental Mindoro').trim();
    const permitNumber = (quarryDetails.permit_number || selectedApplication?.permit_number || '').trim() || null;
    const permitExpiresAt = quarryDetails.permit_expires_at || null;
    const annualAllowableVolume = quarryDetails.annual_allowable_volume_cubic_meters !== ''
      ? Number(quarryDetails.annual_allowable_volume_cubic_meters)
      : null;

    if (permitNumber && !permitExpiresAt) {
      toast.error('Enter the permit expiry date');
      return;
    }
    if (!permitNumber && (permitExpiresAt || annualAllowableVolume !== null)) {
      toast.error('Enter the permit number for the permit details');
      return;
    }

    setSavingQuarry(true);
    try {
      const response = await createQuarry({
        name,
        description,
        latitude,
        longitude,
        polygon_coordinates: validDraftPoints,
        address,
        status: selectedApplication ? 'pending' : 'active',
        area_hectares: calcPolygonArea(validDraftPoints),
        permit_number: permitNumber,
        permit_expires_at: permitExpiresAt,
        annual_allowable_volume_cubic_meters: annualAllowableVolume,
      });

      const createdQuarry = response.data.quarry;
      if (selectedApplication?.id) {
        try {
          await approveOperatorApplication(selectedApplication.id, {
            admin_remarks: `Application approved when quarry ${createdQuarry.name} was mapped and created.`,
          });
        } catch {
          toast.error('The quarry was saved, but the application could not be marked approved');
        }
      }

      setQuarries((current) => [...current, createdQuarry]);
      setSelected(createdQuarry);
      setQuarryDraftMode(false);
      navigate('/', { replace: true });
      toast.success(selectedApplication ? 'Quarry boundary saved from the operator application' : 'Quarry created successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'The quarry could not be saved');
    } finally {
      setSavingQuarry(false);
    }
  };

  return (
    <div className="landing-page" style={{ position: 'relative', width: '100%', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Map Container */}
      <div className="public-map-canvas" ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* Layer Control + Map Toolbar */}
      <div className="map-primary-controls" style={{ position: 'absolute', top: 16, left: 16, zIndex: 100, display: 'flex', gap: 10 }}>
        <MapLayerControl map={mapObj} mapRef={mapInstanceRef} is3D={is3D} setIs3D={setIs3D} />
      </div>

      {applicationPickerOpen && (
        <div className="modal-overlay">
          <div className="modal animate-scaleIn" style={{ maxWidth: 620 }}>
            <div className="modal-header" style={{ paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Add Quarry from Application</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  Select a pending operator application before mapping its quarry boundary.
                </p>
              </div>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pending-operator-application">Pending operator application</label>
                <SearchableSelect
                  id="pending-operator-application"
                  value={selectedApplicationId}
                  onChange={setSelectedApplicationId}
                  disabled={applicationsLoading}
                  options={pendingApplications.map((application) => ({
                    value: application.id,
                    label: `${application.company_name} — ${application.applicant_name}`,
                  }))}
                  placeholder={applicationsLoading ? 'Loading applications…' : pendingApplications.length === 0 ? 'No pending applications' : 'Select pending application...'}
                  searchPlaceholder="Search applications..."
                  emptyMessage="No matching application found."
                />
              </div>

              {selectedApplication && (
                <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.82rem', marginBottom: 14 }}>
                    <div><span className="text-muted">Applicant</span><br /><strong>{selectedApplication.applicant_name}</strong></div>
                    <div><span className="text-muted">Location</span><br /><strong>{selectedApplication.quarry_location}</strong></div>
                    <div><span className="text-muted">Permit number</span><br /><strong>{selectedApplication.permit_number || 'Not provided'}</strong></div>
                    <div><span className="text-muted">Submitted</span><br /><strong>{new Date(selectedApplication.created_at).toLocaleDateString()}</strong></div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <p style={{ margin: '0 0 8px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Submitted documents</p>
                    {selectedApplication.document_url ? (
                      <a
                        href={selectedApplication.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 600 }}
                      >
                        <FileText size={18} />
                        {selectedApplication.document_original_name || 'View submitted document'}
                      </a>
                    ) : (
                      <p className="text-muted" style={{ margin: 0, fontSize: '0.82rem' }}>No document was submitted with this application.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={cancelQuarryFlow}>Cancel</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={skipApplicationSelection}
                  title="Skip selecting an operator application and head directly to quarry details"
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={beginCoordinateEntry}
                  disabled={!selectedApplication || applicationsLoading}
                >
                  Next <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active GIS File Floating Notification Pill */}
      {activeGisInfo && (
        <div className="map-gis-status" style={{
          position: 'absolute', bottom: 24, left: 16, zIndex: 90,
          background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(10px)',
          color: '#ffffff', padding: '8px 16px', borderRadius: 99,
          fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.18)',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }}></span>
          <span>GIS Site Plan: <strong style={{ color: '#38BDF8' }}>{activeGisInfo.name}</strong> ({activeGisInfo.count} Zones)</span>
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

      <div className="map-checkpoint-count" style={{ position: 'absolute', bottom: activeGisInfo ? 72 : 24, left: 16, zIndex: 89, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', borderRadius: 99, padding: '7px 12px', boxShadow: '0 4px 14px rgba(15,23,42,0.14)', display: 'flex', alignItems: 'center', gap: 7, color: '#334155', fontSize: '0.75rem', fontWeight: 600 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', border: '2px solid #FFFFFF', boxShadow: '0 0 0 2px rgba(37,99,235,0.2)', display: 'inline-block' }} />
        {checkpoints.length} Checkpoint{checkpoints.length === 1 ? '' : 's'}
      </div>

      {/* Floating Sidebar Panel */}
      {quarryDraftMode ? (
        <form
          className="landing-sidebar"
          onSubmit={saveApplicationQuarry}
          style={{
            position: 'absolute',
            top: 16, right: 16,
            width: 'calc(100% - 32px)',
            maxWidth: 370,
            maxHeight: 'calc(100vh - 100px)',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.16)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <MapPin size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                  {selectedApplication ? 'Map Quarry Boundary' : 'Add New Quarry'}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedApplication ? selectedApplication.company_name : 'Quarry details & boundary'}
                </p>
              </div>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '0.77rem', lineHeight: 1.5, color: '#64748b' }}>
              {selectedApplication
                ? 'Enter at least three latitude and longitude points. Valid points appear on the map immediately.'
                : 'Enter quarry details and boundary coordinates. You can also click the map to add points.'}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
            {/* Quarry Details Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Quarry / Permittee Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. San Pedro Quarry"
                  value={quarryDetails.name}
                  onChange={(e) => setQuarryDetails({ ...quarryDetails, name: e.target.value })}
                  style={{ height: 34, fontSize: '0.82rem' }}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Location / Barangay
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Brgy. San Pedro, Bongabong"
                  value={quarryDetails.address}
                  onChange={(e) => setQuarryDetails({ ...quarryDetails, address: e.target.value })}
                  style={{ height: 34, fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Permit Number <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>(Optional)</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. QP-2026-001"
                  value={quarryDetails.permit_number}
                  onChange={(e) => setQuarryDetails({ ...quarryDetails, permit_number: e.target.value })}
                  style={{ height: 34, fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Permit Expiry Date <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>(Required with permit)</span>
                </label>
                <input
                  className="form-input"
                  type="date"
                  value={quarryDetails.permit_expires_at}
                  onChange={(e) => setQuarryDetails({ ...quarryDetails, permit_expires_at: e.target.value })}
                  style={{ height: 34, fontSize: '0.82rem' }}
                  required={Boolean(quarryDetails.permit_number)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Annual Allowable Consumption (m³/year) <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>(Optional)</span>
                </label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 25000"
                  value={quarryDetails.annual_allowable_volume_cubic_meters}
                  onChange={(e) => setQuarryDetails({ ...quarryDetails, annual_allowable_volume_cubic_meters: e.target.value })}
                  style={{ height: 34, fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ fontSize: '0.78rem', color: '#1e293b' }}>Boundary Coordinates</strong>
              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Click map or enter below</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {draftPoints.map((point, index) => (
                <div key={point.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong style={{ fontSize: '0.78rem', color: '#334155' }}>Point {index + 1}</strong>
                    <button
                      type="button"
                      className="btn-ghost btn-icon text-danger"
                      onClick={() => removeDraftPoint(point.id)}
                      disabled={draftPoints.length === 1}
                      title="Remove point"
                      style={{ width: 26, height: 26, padding: 4 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label className="form-group" style={{ gap: 4 }}>
                      <span className="form-label" style={{ fontSize: '0.7rem' }}>Latitude</span>
                      <input
                        className="form-input"
                        type="number"
                        step="any"
                        min="-90"
                        max="90"
                        value={point.latitude}
                        onChange={(event) => updateDraftPoint(point.id, 'latitude', event.target.value)}
                        placeholder="12.7480"
                        required
                      />
                    </label>
                    <label className="form-group" style={{ gap: 4 }}>
                      <span className="form-label" style={{ fontSize: '0.7rem' }}>Longitude</span>
                      <input
                        className="form-input"
                        type="number"
                        step="any"
                        min="-180"
                        max="180"
                        value={point.longitude}
                        onChange={(event) => updateDraftPoint(point.id, 'longitude', event.target.value)}
                        placeholder="121.4892"
                        required
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="btn btn-secondary" onClick={addDraftPoint} style={{ width: '100%', marginTop: 12 }}>
              <Plus size={16} /> Add another point
            </button>

            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 9, background: validDraftPoints.length >= 3 ? '#ECFDF5' : '#EFF6FF', color: validDraftPoints.length >= 3 ? '#047857' : '#1D4ED8', fontSize: '0.76rem' }}>
              <strong>{validDraftPoints.length} valid point{validDraftPoints.length === 1 ? '' : 's'}</strong>
              {validDraftPoints.length >= 3
                ? ` · Boundary area: ${calcPolygonArea(validDraftPoints)} ha`
                : ` · Add ${3 - validDraftPoints.length} more to form a boundary`}
            </div>
          </div>

          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#fff' }}>
            <button type="button" className="btn btn-secondary" onClick={cancelQuarryFlow}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={savingQuarry || validDraftPoints.length < 3}>
              <Save size={16} /> {savingQuarry ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : sidebarCollapsed ? (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          className="landing-sidebar-toggle-btn"
          title="Expand Quarries Sidebar"
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
            <Mountain size={15} />
          </div>
          <span>Quarries ({filteredQuarries.length})</span>
          <ChevronLeft size={16} style={{ color: '#64748b' }} />
        </button>
      ) : (
        <div className="landing-sidebar" style={{
          position: 'absolute',
          top: 16, right: 16,
          width: 'calc(100% - 32px)',
          maxWidth: 340,
          maxHeight: 'calc(100vh - 100px)',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          borderRadius: 14,
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.14)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.25s ease',
        }}>
          {/* Search Header */}
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Mountain size={18} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F766E' }}>Quarries & Topography</h2>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Bongabong, Oriental Mindoro</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="btn-ghost btn-icon"
                title="Collapse sidebar"
                style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <ChevronRight size={18} style={{ color: '#64748b' }} />
              </button>
            </div>

            <div className="search-box" style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search permittee or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 34, fontSize: '0.85rem', height: 36 }}
              />
            </div>

            {/* Status Filter Pills (Sheryl May Lainez Recommendation) */}
            <div style={{ display: 'flex', gap: 4, marginTop: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {[
                { id: '', label: 'All' },
                { id: 'active', label: 'Active', color: '#10B981' },
                { id: 'pending', label: 'Pending', color: '#F59E0B' },
                { id: 'illegal', label: 'Illegal', color: '#EF4444' },
                { id: 'inactive', label: 'Inactive', color: '#9CA3AF' },
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 99,
                    fontSize: '0.68rem',
                    fontWeight: statusFilter === st.id ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    background: statusFilter === st.id ? (st.color || '#0F766E') : '#f1f5f9',
                    color: statusFilter === st.id ? '#fff' : '#475569',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {openOperatorModal && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--primary-light, #e6f4f1)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary-dark, #0d5c56)' }}>Own a Quarry?</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Apply to register as an Operator</p>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                  onClick={openOperatorModal}
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Quarry List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
            {loading ? (
              <div className="loader-container" style={{ padding: 30 }}><div className="spinner" /></div>
            ) : filteredQuarries.length === 0 ? (
              <p className="text-center text-muted" style={{ padding: 20, fontSize: '0.85rem' }}>No quarries found</p>
            ) : (
              filteredQuarries.map((q) => (
                <div
                  key={q.id}
                  onClick={() => selectQuarry(q)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    marginBottom: 8,
                    cursor: 'pointer',
                    border: `1.5px solid ${selected?.id === q.id ? '#0F766E' : q.status === 'illegal' ? '#FCA5A5' : 'var(--border-light)'}`,
                    background: selected?.id === q.id ? 'rgba(15,118,110,0.06)' : q.status === 'illegal' ? '#FEF2F2' : 'var(--surface)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: q.status === 'illegal' ? '#991B1B' : '#1e293b' }}>
                      {q.name}
                    </h4>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: q.status === 'active' ? '#CCFBF1' : q.status === 'illegal' ? '#FEE2E2' : q.status === 'pending' ? '#FEF3C7' : '#F3F4F6',
                      color: q.status === 'illegal' ? '#DC2626' : (statusColors[q.status] || '#4B5563'),
                    }}>
                      {q.status === 'illegal' ? '⚠️ ILLEGAL' : q.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <MapPin size={13} /> {q.address || 'Bongabong, Oriental Mindoro'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#0F766E', fontWeight: 500 }}>
                      {q.area_hectares ? `${q.area_hectares} ha` : 'Registered Permit'}
                    </span>
                    <Link to={`/quarry/${q.id}`} className="btn-link" style={{ fontSize: '0.75rem', color: '#0F766E', fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>
                      View Details →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
