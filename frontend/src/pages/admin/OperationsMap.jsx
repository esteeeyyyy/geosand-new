import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, LocateFixed, MapPin, Navigation, Radio, RefreshCw, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getAnalytics } from '../../api/analytics';
import { getQuarries } from '../../api/quarries';
import { getCheckpoints } from '../../api/checkpoints';
import { MapLayerControl } from '../../components/MapLayerToggle';
import AdminPageActions from '../../components/AdminPageActions';

const statusColor = { verified: '#16A34A', pending: '#D97706', rejected: '#DC2626' };

const asCollections = (quarries, routes, checkpoints) => {
  const quarryFeatures = quarries.map((q) => ({
    type: 'Feature',
    properties: { id: q.id, name: q.name, status: q.status, permit: q.permit_status },
    geometry: { type: 'Point', coordinates: [Number(q.longitude), Number(q.latitude)] },
  }));
  const routeFeatures = routes.filter((r) => r.current_position || r.checkpoint).map((route) => {
    const destination = route.current_position || route.checkpoint;
    return {
    type: 'Feature', properties: { code: route.tracking_code, status: route.status },
    geometry: { type: 'LineString', coordinates: [[route.origin.lng, route.origin.lat], [destination.lng, destination.lat]] },
  };
  });
  const vehicleFeatures = routes.map((route) => {
    const location = route.current_position || route.checkpoint || route.origin;
    return {
      type: 'Feature',
      properties: { code: route.tracking_code, truck: route.truck, status: route.status, material: route.material, destination: route.destination, source: route.current_position ? 'gps' : route.checkpoint ? 'checkpoint' : 'quarry' },
      geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
    };
  });
  const checkpointFeatures = checkpoints.map((checkpoint) => ({
    type: 'Feature',
    properties: {
      id: checkpoint.id,
      name: checkpoint.name || 'Checkpoint',
      address: checkpoint.address || 'No address provided',
      status: checkpoint.is_active ? 'active' : 'inactive',
    },
    geometry: { type: 'Point', coordinates: [Number(checkpoint.longitude), Number(checkpoint.latitude)] },
  })).filter((feature) => feature.geometry.coordinates.every(Number.isFinite));
  return {
    quarries: { type: 'FeatureCollection', features: quarryFeatures },
    routes: { type: 'FeatureCollection', features: routeFeatures },
    vehicles: { type: 'FeatureCollection', features: vehicleFeatures },
    checkpoints: { type: 'FeatureCollection', features: checkpointFeatures },
  };
};

export default function OperationsMap() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [is3D, setIs3D] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [quarries, setQuarries] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [selected, setSelected] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOperations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [analytics, quarryResponse, checkpointResponse] = await Promise.all([
        getAnalytics({ period: 'month' }),
        getQuarries({ per_page: 100 }),
        getCheckpoints({ per_page: 100 }).catch(() => ({ data: { checkpoints: [] } })),
      ]);
      setRoutes(analytics.data.hauling_routes || []);
      setQuarries(quarryResponse.data.quarries || []);
      setCheckpoints(checkpointResponse.data.checkpoints || []);
      setLastSync(new Date());
    } catch {
      if (!silent) toast.error('Operations feed could not be loaded');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOperations();
    const timer = window.setInterval(() => loadOperations(true), 15000);
    return () => window.clearInterval(timer);
  }, [loadOperations]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const instance = new maplibregl.Map({
      container: containerRef.current,
      center: [121.4892, 12.748], zoom: 10.8, maxPitch: 85,
      style: {
        version: 8,
        sources: {
          'osm-tiles': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 },
          'satellite-tiles': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 },
          'topo-tiles': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 },
          'terrain-dem': { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 15 },
          'hillshade-dem': { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 15 },
          'operation-quarries': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          'operation-checkpoints': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          'hauling-routes': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          'vehicle-locations': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        },
        layers: [
          { id: 'offline-background', type: 'background', paint: { 'background-color': '#E7EFE9' } },
          { id: 'base-street', type: 'raster', source: 'osm-tiles' },
          { id: 'base-satellite', type: 'raster', source: 'satellite-tiles', layout: { visibility: 'none' } },
          { id: 'base-topo', type: 'raster', source: 'topo-tiles', layout: { visibility: 'none' } },
          { id: 'hills', type: 'hillshade', source: 'hillshade-dem', layout: { visibility: 'none' }, paint: { 'hillshade-exaggeration': 0.65 } },
          { id: 'route-casing', type: 'line', source: 'hauling-routes', paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 } },
          { id: 'route-lines', type: 'line', source: 'hauling-routes', paint: { 'line-color': ['match', ['get', 'status'], 'verified', '#16A34A', 'rejected', '#DC2626', '#D97706'], 'line-width': 4, 'line-dasharray': [2, 1] } },
          { id: 'quarry-sites', type: 'circle', source: 'operation-quarries', paint: { 'circle-color': ['match', ['get', 'status'], 'active', '#0F766E', 'illegal', '#DC2626', '#D97706'], 'circle-radius': 8, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } },
          { id: 'checkpoint-pulse', type: 'circle', source: 'operation-checkpoints', paint: { 'circle-color': ['match', ['get', 'status'], 'active', '#2563EB', '#94A3B8'], 'circle-radius': 14, 'circle-opacity': 0.2 } },
          { id: 'checkpoint-markers', type: 'circle', source: 'operation-checkpoints', paint: { 'circle-color': ['match', ['get', 'status'], 'active', '#2563EB', '#94A3B8'], 'circle-radius': 7, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' } },
          { id: 'vehicle-pulse', type: 'circle', source: 'vehicle-locations', paint: { 'circle-color': ['match', ['get', 'status'], 'verified', '#16A34A', 'rejected', '#DC2626', '#D97706'], 'circle-radius': 14, 'circle-opacity': 0.22 } },
          { id: 'vehicles', type: 'circle', source: 'vehicle-locations', paint: { 'circle-color': ['match', ['get', 'status'], 'verified', '#16A34A', 'rejected', '#DC2626', '#D97706'], 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } },
        ],
      },
    });
    mapRef.current = instance;
    instance.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    instance.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'bottom-right');
    instance.on('load', () => setMap(instance));
    instance.on('click', 'vehicles', (event) => {
      const props = event.features?.[0]?.properties;
      if (props) setSelected(props.code);
    });
    instance.on('mouseenter', 'vehicles', () => { instance.getCanvas().style.cursor = 'pointer'; });
    instance.on('mouseleave', 'vehicles', () => { instance.getCanvas().style.cursor = ''; });
    instance.on('click', 'checkpoint-markers', (event) => {
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
        .addTo(instance);
    });
    instance.on('mouseenter', 'checkpoint-markers', () => { instance.getCanvas().style.cursor = 'pointer'; });
    instance.on('mouseleave', 'checkpoint-markers', () => { instance.getCanvas().style.cursor = ''; });
    return () => { instance.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!map?.isStyleLoaded()) return;
    const collections = asCollections(quarries, routes, checkpoints);
    map.getSource('operation-quarries')?.setData(collections.quarries);
    map.getSource('hauling-routes')?.setData(collections.routes);
    map.getSource('vehicle-locations')?.setData(collections.vehicles);
    map.getSource('operation-checkpoints')?.setData(collections.checkpoints);
  }, [map, quarries, routes, checkpoints]);

  const focusRoute = (route) => {
    setSelected(route.tracking_code);
    const point = route.current_position || route.checkpoint || route.origin;
    mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 14, duration: 900 });
  };

  const active = routes.find((route) => route.tracking_code === selected);

  return (
    <div className="animate-fadeIn operations-page">
      <div className="page-header">
        <div><h1>GIS Operations Map</h1><p>Live hauling positions, routes, quarry geotags, and delivery status.</p></div>
        <div className="flex gap-2 items-center no-print" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="live-status"><span className="live-dot" /><strong>Live operations feed</strong><small>{lastSync ? `Updated ${lastSync.toLocaleTimeString()}` : 'Connecting…'}</small></div>
          <AdminPageActions />
        </div>
      </div>

      <div className="operations-layout">
        <div className="operations-map-card">
          <div ref={containerRef} className="operations-map" />
          <div className="operations-map-tools"><MapLayerControl map={map} mapRef={mapRef} is3D={is3D} setIs3D={setIs3D} /></div>
          <button className="map-refresh btn btn-secondary btn-sm" onClick={() => loadOperations()} disabled={loading}><RefreshCw size={15} /> Refresh</button>
          <div className="map-legend"><span><i style={{ background: '#0F766E' }} /> Quarry</span><span><i style={{ background: '#2563EB' }} /> Checkpoint</span><span><i style={{ background: '#D97706' }} /> In transit</span><span><i style={{ background: '#16A34A' }} /> Verified</span><span><i style={{ background: '#DC2626' }} /> Rejected</span></div>
        </div>

        <aside className="operations-feed card">
          <div className="card-header"><h3><Truck size={18} /> Delivery monitoring</h3><span className="badge badge-success">{routes.length} tracked</span></div>
          <div className="operations-feed-list">
            {routes.map((route) => <button key={route.tracking_code} className={`route-item ${selected === route.tracking_code ? 'active' : ''}`} onClick={() => focusRoute(route)}>
              <span className="route-icon" style={{ color: statusColor[route.status] }}><Truck size={18} /></span>
              <span className="route-copy"><strong>{route.truck}</strong><small>{route.tracking_code} · {route.material}</small><em><MapPin size={11} /> {route.origin.name} → {route.destination}</em></span>
              <span className={`badge ${route.status === 'verified' ? 'badge-success' : route.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{route.status}</span>
            </button>)}
            {!routes.length && <div className="empty-state"><Truck size={30} /><h3>No hauling activity</h3><p>New submissions will appear here automatically.</p></div>}
          </div>
        </aside>
      </div>

      {active && <div className="route-details card">
        <div><span className="detail-icon"><Radio size={18} /></span><p>Tracking code<strong>{active.tracking_code}</strong></p></div>
        <div><span className="detail-icon"><Truck size={18} /></span><p>Vehicle<strong>{active.truck}</strong></p></div>
        <div><span className="detail-icon"><Navigation size={18} /></span><p>Route<strong>{active.origin.name} → {active.checkpoint?.name || 'Awaiting checkpoint'}</strong></p></div>
        <div><span className="detail-icon"><LocateFixed size={18} /></span><p>Last known position<strong>{active.current_position ? `Live GPS · ${active.current_position.accuracy_m ? `±${active.current_position.accuracy_m} m` : 'device fix'}` : active.checkpoint?.name || active.origin.name}</strong></p></div>
        <div><span className="detail-icon"><Clock size={18} /></span><p>Delivery status<strong style={{ textTransform: 'capitalize' }}>{active.status}</strong></p></div>
      </div>}

      <p className="text-xs text-muted" style={{ marginTop: 10 }}>Positions update every 15 seconds from shared vehicle GPS, quarry submissions, and checkpoint verifications. When GPS is unavailable, the map shows the most recent checkpoint or geotagged quarry origin.</p>
    </div>
  );
}
