import { useState, useEffect, useCallback, useRef } from 'react';
import { Crosshair, Maximize2, Minimize2, Ruler, X } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';

// Geolocation Control
export function GeolocationControl({ map }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);
  const markerRef = useRef(null);
  const watchRef = useRef(null);

  useEffect(() => {
    return () => {
      if (markerRef.current) markerRef.current.remove();
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    setLoading(true);
    setError(null);
    setActive(true);

    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLoading(false);
        
        if (map) {
          if (!markerRef.current) {
            const el = document.createElement('div');
            el.className = 'geolocation-marker';
            el.style.cssText = 'width: 14px; height: 14px; background: #2563EB; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 10px rgba(37,99,235,0.6);';
            markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
          } else {
            markerRef.current.setLngLat([longitude, latitude]);
          }

          map.flyTo({ center: [longitude, latitude], zoom: 15, duration: 1200 });
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
        setActive(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [map]);

  return (
    <button className={`map-control-btn ${active ? 'active' : ''} ${loading ? 'loading' : ''}`} onClick={locate} title={error || 'Find my location'} type="button">
      <Crosshair size={16} className={loading ? 'spin-slow' : ''} />
    </button>
  );
}

// Fullscreen Control
export function FullscreenControl({ map }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => map?.resize(), 350);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [map]);

  const toggle = useCallback(() => {
    if (!map) return;
    const container = map.getContainer();

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) container.requestFullscreen();
      else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }, [map]);

  return (
    <button className="map-control-btn" onClick={toggle} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'} type="button">
      {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );
}

// ScaleBar
export function ScaleBar({ map }) {
  const [scale, setScale] = useState({ width: 0, label: '' });

  const updateScale = useCallback(() => {
    if (!map) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const metersPerPixel = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom);
    
    const targetMeters = metersPerPixel * 100;
    const niceValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
    let nice = niceValues[0];
    for (const v of niceValues) {
      if (v <= targetMeters) nice = v;
      else break;
    }
    
    const width = nice / metersPerPixel;
    const label = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;
    setScale({ width, label });
  }, [map]);

  useEffect(() => {
    if (!map) return;
    updateScale();
    map.on('zoom', updateScale);
    map.on('move', updateScale);
    return () => {
      map.off('zoom', updateScale);
      map.off('move', updateScale);
    };
  }, [map, updateScale]);

  if (!scale.width) return null;

  return (
    <div className="map-scale-bar" style={{
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(4px)',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: '0.72rem',
      fontWeight: 600,
      color: '#334155',
      border: '1px solid rgba(0,0,0,0.1)'
    }}>
      <div className="map-scale-bar-line" style={{ width: scale.width, height: 3, background: '#0F766E', marginBottom: 2, borderRadius: 2 }} />
      <span className="map-scale-bar-label">{scale.label}</span>
    </div>
  );
}

// Coordinate Display
export function CoordinateDisplay({ map }) {
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!map) return;

    const handleMouseMove = (e) => {
      setCoords({
        lng: e.lngLat.lng.toFixed(4),
        lat: e.lngLat.lat.toFixed(4),
      });
    };

    map.on('mousemove', handleMouseMove);
    return () => map.off('mousemove', handleMouseMove);
  }, [map]);

  if (!coords) return null;

  return (
    <div className="map-coordinate-display" style={{
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(6px)',
      color: '#F8FAFC',
      padding: '4px 10px',
      borderRadius: 6,
      fontSize: '0.72rem',
      fontFamily: 'monospace',
      letterSpacing: '0.02em',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
    }}>
      Lng: {coords.lng}° | Lat: {coords.lat}°
    </div>
  );
}

// Measurement Tool placeholder
export function MeasurementTool({ map }) {
  const [active, setActive] = useState(false);

  return (
    <button
      className={`map-control-btn ${active ? 'active' : ''}`}
      onClick={() => setActive(!active)}
      title="Measure distance"
      type="button"
    >
      <Ruler size={16} />
    </button>
  );
}

export function MapControlsToolbar({ children }) {
  return (
    <div className="map-controls-toolbar" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      zIndex: 1000
    }}>
      {children}
    </div>
  );
}

// Calculate polygon area in hectares from array of [lat, lng] points
export function calcPolygonArea(pts) {
  if (!pts || pts.length < 3) return 0;
  const R = 6378137; // Earth radius in meters
  const avgLat = (pts.reduce((sum, p) => sum + p[0], 0) / pts.length) * (Math.PI / 180);
  const cosLat = Math.cos(avgLat);

  const coords = pts.map(([lat, lng]) => ({
    x: R * (lng * Math.PI / 180) * cosLat,
    y: R * (lat * Math.PI / 180),
  }));

  let areaM2 = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    areaM2 += coords[i].x * coords[j].y;
    areaM2 -= coords[j].x * coords[i].y;
  }
  areaM2 = Math.abs(areaM2) / 2;
  const hectares = areaM2 / 10000;
  return parseFloat(hectares.toFixed(2));
}

