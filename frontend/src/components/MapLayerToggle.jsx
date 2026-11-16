import { useState, useEffect, useRef, useCallback } from 'react';
import { Layers, Map as MapIcon, Satellite, Mountain, ChevronDown, Box, Download, CheckCircle2, CloudOff, LoaderCircle } from 'lucide-react';
import { cacheCurrentMapView, getOfflineMapInfo } from '../utils/offlineMaps';

// Keep a requested setting pending until MapLibre accepts it. getStyle() can
// expose definitions before style mutations are safe on a restored mobile map.
function keepMapStateInSync(map, action) {
  if (!map) return () => {};

  let cancelled = false;
  let retryTimer = null;
  let attempts = 0;

  const apply = () => {
    if (cancelled) return;

    try {
      if (action()) {
        attempts = 0;
        return;
      }
    } catch {
      // The style can exist before it is ready to be mutated. Retry below.
    }

    attempts += 1;
    if (attempts < 60) {
      clearTimeout(retryTimer);
      retryTimer = window.setTimeout(apply, 100);
    }
  };

  const handleStyleLoad = () => {
    attempts = 0;
    apply();
  };

  apply();
  map.on('style.load', handleStyleLoad);

  return () => {
    cancelled = true;
    clearTimeout(retryTimer);
    map.off('style.load', handleStyleLoad);
  };
}

export function MapLayerControl({ map, mapRef, is3D, setIs3D }) {
  const [open, setOpen] = useState(false);
  const [basemap, setBasemap] = useState('street');
  const [gisLayers, setGisLayers] = useState({
    province: true,
    municipality: true,
    barangays: true,
  });
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineState, setOfflineState] = useState(() => getOfflineMapInfo() ? 'saved' : 'idle');
  const [offlineProgress, setOfflineProgress] = useState(0);
  const [offlineMessage, setOfflineMessage] = useState('');
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Prefer mapRef.current (set synchronously on map creation, before load event)
  // Fall back to map prop (state-based, set after load event)
  const getMap = useCallback(() => (mapRef && mapRef.current) || map || null, [mapRef, map]);

  // Apply basemap layer visibility directly to map
  const applyBasemap = (m, targetBasemap) => {
    const baseLayers = ['base-street', 'base-satellite', 'base-topo'];
    let updatedLayers = 0;

    baseLayers.forEach((layerId) => {
      if (m.getLayer && m.getLayer(layerId)) {
        const target = layerId === `base-${targetBasemap}` ? 'visible' : 'none';
        m.setLayoutProperty(layerId, 'visibility', target);
        updatedLayers += 1;
      }
    });

    return updatedLayers === baseLayers.length;
  };

  const handleBasemapChange = (newBasemap) => {
    setBasemap(newBasemap);
  };

  useEffect(() => {
    const m = getMap();
    if (!m) return undefined;

    return keepMapStateInSync(m, () => applyBasemap(m, basemap));
  }, [basemap, getMap]);


  // Toggle 3D Terrain Pitching & DEM mesh when is3D changes
  useEffect(() => {
    const m = getMap();
    if (!m) return undefined;

    let cameraApplied = false;
    
    const apply3D = () => {
      if (!cameraApplied) {
        m.easeTo({
          pitch: is3D ? 60 : 0,
          bearing: is3D ? -15 : 0,
          duration: is3D ? 1000 : 800,
        });
        cameraApplied = true;
      }

      const hasHills = Boolean(m.getLayer && m.getLayer('hills'));

      if (is3D) {
        const hasTerrain = Boolean(m.getSource && m.getSource('terrain-dem'));
        if (hasHills) m.setLayoutProperty('hills', 'visibility', 'visible');
        if (hasTerrain) m.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
        return hasHills && hasTerrain;
      } else {
        if (hasHills) m.setLayoutProperty('hills', 'visibility', 'none');
        if (typeof m.setTerrain === 'function') m.setTerrain(null);
        return hasHills;
      }
    };

    return keepMapStateInSync(m, apply3D);
  }, [is3D, getMap]);

  const toggle3DTerrain = () => {
    setIs3D(prev => !prev);
  };

  // Toggle GIS Layer visibility
  useEffect(() => {
    const m = getMap();
    if (!m) return undefined;

    const applyGisLayers = () => {
      let updatedLayers = 0;
      let expectedLayers = 0;

      const setGroupVisibility = (layerIds, visible) => {
        layerIds.forEach((id) => {
          expectedLayers += 1;
          if (m.getLayer && m.getLayer(id)) {
            m.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
            updatedLayers += 1;
          }
        });
      };

      // Province
      setGroupVisibility(['gis-province-fill', 'gis-province-line'], gisLayers.province);

      // Municipality
      setGroupVisibility(
        ['gis-municipality-fill', 'gis-municipality-casing', 'gis-municipality-line'],
        gisLayers.municipality,
      );

      // Barangays
      setGroupVisibility(['gis-brgy-fill', 'gis-brgy-line'], gisLayers.barangays);

      return updatedLayers === expectedLayers;
    };

    return keepMapStateInSync(m, applyGisLayers);
  }, [gisLayers, getMap]);

  const toggleGis = (key) => setGisLayers(prev => ({ ...prev, [key]: !prev[key] }));

  const saveOfflineArea = async () => {
    const m = getMap();
    if (!m || offlineState === 'saving') return;

    setOfflineState('saving');
    setOfflineProgress(0);
    setOfflineMessage('Saving visible map area...');

    try {
      const info = await cacheCurrentMapView(m, ({ completed, total }) => {
        setOfflineProgress(Math.round((completed / total) * 100));
      });
      setOfflineState('saved');
      setOfflineMessage(`${info.tileCount} map tiles saved for offline use${info.failedCount ? ` (${info.failedCount} unavailable)` : ''}.`);
    } catch (error) {
      setOfflineState('error');
      setOfflineMessage(error.message || 'Unable to save the offline map area.');
    }
  };

  const offlineIcon = !isOnline
    ? <CloudOff size={15} />
    : offlineState === 'saving'
      ? <LoaderCircle size={15} className="spin-slow" />
      : offlineState === 'saved'
        ? <CheckCircle2 size={15} />
        : <Download size={15} />;

  const offlineLabel = !isOnline
    ? 'Offline'
    : offlineState === 'saving'
      ? `${offlineProgress}%`
      : offlineState === 'saved'
        ? 'Saved'
        : 'Save offline';

  return (
    <div className="map-layer-toggle-container" ref={panelRef} style={{ position: 'relative', display: 'flex', gap: 6 }}>
      <button
        className="map-layer-toggle-btn"
        onClick={() => setOpen(o => !o)}
        title="Map layers & Basemaps"
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 0, 0, 0.12)',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.82rem',
          color: '#1e293b'
        }}
      >
        <Layers size={16} className="text-teal-600" />
        <span>Layers</span>
        <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      <button
        type="button"
        className="map-terrain-toggle-btn"
        onClick={toggle3DTerrain}
        title={is3D ? 'Disable 3D Elevation' : 'Enable 3D Elevation'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '8px 12px',
          background: is3D ? '#0F766E' : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${is3D ? '#0F766E' : 'rgba(0, 0, 0, 0.12)'}`,
          borderRadius: 8,
          boxShadow: is3D ? '0 4px 14px rgba(15,118,110,0.35)' : '0 4px 12px rgba(0,0,0,0.08)',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '0.82rem',
          color: is3D ? '#FFFFFF' : '#1e293b',
          transition: 'all 0.2s ease',
        }}
      >
        <Box size={15} />
        <span>3D {is3D ? 'ON' : 'OFF'}</span>
      </button>

      <button
        type="button"
        className="map-offline-toggle-btn"
        onClick={saveOfflineArea}
        disabled={!isOnline || offlineState === 'saving'}
        title={!isOnline ? (getOfflineMapInfo() ? 'Using saved offline map data' : 'No offline map area has been saved') : (offlineMessage || 'Save the current map area for offline use')}
        aria-label="Save current map area for offline use"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '8px 12px',
          background: offlineState === 'saved' || !isOnline ? '#1D4ED8' : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${offlineState === 'saved' || !isOnline ? '#1D4ED8' : 'rgba(0, 0, 0, 0.12)'}`,
          borderRadius: 8,
          boxShadow: offlineState === 'saved' || !isOnline ? '0 4px 14px rgba(29,78,216,0.3)' : '0 4px 12px rgba(0,0,0,0.08)',
          cursor: !isOnline || offlineState === 'saving' ? 'default' : 'pointer',
          fontWeight: 700,
          fontSize: '0.82rem',
          color: offlineState === 'saved' || !isOnline ? '#FFFFFF' : '#1e293b',
          opacity: offlineState === 'saving' ? 0.85 : 1,
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {offlineIcon}
        <span>{offlineLabel}</span>
      </button>

      {offlineMessage && (
        <div role="status" aria-live="polite" style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 250,
          padding: '9px 11px',
          borderRadius: 8,
          background: offlineState === 'error' ? '#FEF2F2' : 'rgba(15,23,42,0.94)',
          color: offlineState === 'error' ? '#B91C1C' : '#FFFFFF',
          boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
          fontSize: '0.74rem',
          lineHeight: 1.35,
          zIndex: 2100,
        }}>
          {offlineMessage}
        </div>
      )}

      {open && (
        <div className="map-layer-panel" style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: 12,
          padding: '14px 16px',
          minWidth: 230,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
          zIndex: 2000,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          {/* 3D Terrain Pitching Toggle */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              3D Elevation View
            </p>
            <button
              type="button"
              onClick={toggle3DTerrain}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 8,
                border: `1.5px solid ${is3D ? '#0F766E' : '#cbd5e1'}`,
                background: is3D ? 'rgba(15, 118, 110, 0.1)' : '#f8fafc',
                color: is3D ? '#0F766E' : '#475569',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Box size={16} />
                <span>{is3D ? '3D Mountain Relief (Active)' : 'Enable 3D Terrain'}</span>
              </div>
              <div style={{
                width: 32, height: 18, borderRadius: 9,
                background: is3D ? '#0F766E' : '#cbd5e1',
                position: 'relative',
                transition: 'background 0.2s'
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: is3D ? 16 : 2,
                  width: 14, height: 14, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s'
                }} />
              </div>
            </button>
          </div>

          {/* Basemap section */}
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Basemap Style
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[
              { id: 'street', label: 'Street', icon: <MapIcon size={13} /> },
              { id: 'satellite', label: 'Satellite', icon: <Satellite size={13} /> },
              { id: 'topo', label: 'Topo', icon: <Mountain size={13} /> },
            ].map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleBasemapChange(id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: `1.5px solid ${basemap === id ? '#0F766E' : '#e2e8f0'}`,
                  background: basemap === id ? 'rgba(15,118,110,0.08)' : 'transparent',
                  color: basemap === id ? '#0F766E' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: basemap === id ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* GIS Layers section */}
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Boundary Layers
          </p>
          {[
            { key: 'province',     label: 'Oriental Mindoro',  color: '#94a3b8', desc: 'Province context' },
            { key: 'municipality', label: 'Bongabong',          color: '#F97316', desc: 'Municipal boundary' },
            { key: 'barangays',   label: 'Barangays',          color: '#14b8a6', desc: '36 sub-areas' },
          ].map(({ key, label, color, desc }) => (
            <div
              key={key}
              onClick={() => toggleGis(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 4px',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 0.1s',
                userSelect: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 32, height: 18, borderRadius: 9,
                background: gisLayers[key] ? color : '#cbd5e1',
                transition: 'background 0.2s',
                position: 'relative',
                flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute',
                  top: 2, left: gisLayers[key] ? 16 : 2,
                  width: 14, height: 14,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s',
                }} />
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: gisLayers[key] ? '#1e293b' : '#94a3b8', lineHeight: 1.2 }}>{label}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MapLayerControl;
