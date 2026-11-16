import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getQuarries, getQuarry, createQuarry, updateQuarry, deleteQuarry, createQuarryPermit, uploadGisFile, deleteGisFile } from '../../api/quarries';
import { MapLayerControl } from '../../components/MapLayerToggle';
import { ScaleBar, CoordinateDisplay, calcPolygonArea } from '../../components/MapControls';
import { Plus, Search, Edit2, Trash2, X, User, Users, Hexagon, Undo2, Upload, FileJson, FileText, AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination';
import AdminPageActions from '../../components/AdminPageActions';
import SearchableSelect from '../../components/SearchableSelect';
import useClientPagination from '../../hooks/useClientPagination';

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const quarryStatusTabs = [
  { value: '', label: 'All', color: '#64748B' },
  { value: 'active', label: 'Active', color: '#10B981' },
  { value: 'pending', label: 'Pending', color: '#F59E0B' },
  { value: 'inactive', label: 'Inactive', color: '#94A3B8' },
  { value: 'suspended', label: 'Suspended', color: '#D97706' },
  { value: 'illegal', label: 'Illegal', color: '#EF4444' },
];

const permitExpiryFromIssueDate = (issueDate) => {
  if (!issueDate) return '';
  const [year, month, day] = issueDate.split('-').map(Number);
  if (!year || !month || !day) return '';
  const expiryYear = year + 1;
  const lastDay = new Date(expiryYear, month, 0).getDate();
  return `${expiryYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
};

const dayAfter = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
};

const localDateString = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function AdminQuarries() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [quarries, setQuarries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [permitFilter, setPermitFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', latitude:'', longitude:'', address:'', status:'active', area_hectares:'', annual_allowable_volume_cubic_meters:'', permit_number:'', permit_issued_at:'' });
  const [polygon, setPolygonRaw] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editingQuarry, setEditingQuarry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showRenewal, setShowRenewal] = useState(false);
  const [renewSaving, setRenewSaving] = useState(false);
  const [renewForm, setRenewForm] = useState({ permit_number: '', issued_at: '', annual_allowable_volume_cubic_meters: '', document: null });
  const [showEditor, setShowEditor] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const permitHistoryPagination = useClientPagination(editingQuarry?.permits || []);

  // GIS file upload state
  const [gisPending, setGisPending] = useState(null);   // File object queued for upload
  const [gisUploading, setGisUploading] = useState(false);
  const [gisPreview, setGisPreview] = useState(null);   // { name, pointCount, area } parsed client-side
  const [gisError, setGisError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const gisInputRef = useRef(null);

  // Map state
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapObj, setMapObj] = useState(null);

  const calcCentroid = (pts) => {
    if (pts.length < 3) return null;
    const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return { lat: lat.toFixed(7), lng: lng.toFixed(7) };
  };

  const setPolygon = (updater) => {
    setPolygonRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const center = calcCentroid(next);
      if (center) {
        setForm(f => ({ ...f, latitude: center.lat, longitude: center.lng }));
      }
      if (next.length >= 3) {
        const area = calcPolygonArea(next);
        setForm(f => ({ ...f, area_hectares: area }));
      } else {
        setForm(f => ({ ...f, area_hectares: '' }));
      }
      return next;
    });
  };

  const fetchData = (p = page) => {
    setLoading(true);
    getQuarries({ search, status: statusFilter || undefined, permit_status: permitFilter || undefined, page: p, per_page: 10 })
      .then(res => { setQuarries(res.data.quarries); setMeta(res.data.meta); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(1); setPage(1); }, [search, statusFilter, permitFilter]);
  useEffect(() => { fetchData(); }, [page]);

  // ─── Client-side GeoJSON parser ────────────────────────────────────────────
  const parseGeoJsonFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          let ring = null;

          const extractRing = (geom) => {
            if (!geom) return null;
            if (geom.type === 'Polygon') return geom.coordinates?.[0] ?? null;
            if (geom.type === 'MultiPolygon') return geom.coordinates?.[0]?.[0] ?? null;
            return null;
          };

          if (data.type === 'FeatureCollection') {
            for (const f of data.features ?? []) {
              ring = extractRing(f.geometry); if (ring) break;
            }
          } else if (data.type === 'Feature') {
            ring = extractRing(data.geometry);
          } else {
            ring = extractRing(data);
          }

          if (!ring || ring.length < 3) return resolve(null);

          // GeoJSON: [lng, lat] → our store: [lat, lng]
          const coords = ring.map(pt => [pt[1], pt[0]]);
          resolve(coords);
        } catch {
          resolve(null);
        }
      };
      reader.readAsText(file);
    });
  };

  const isGeoJson = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    return ['json', 'geojson'].includes(ext);
  };

  const handleGisFile = async (file) => {
    if (!file) return;
    setGisError(null);
    setGisPending(file);
    setGisPreview(null);

    if (isGeoJson(file)) {
      const coords = await parseGeoJsonFile(file);
      if (coords) {
        setPolygon(coords);
        setGisPreview({ name: file.name, pointCount: coords.length });
      } else {
        setGisError('Could not parse GeoJSON — no polygon found.');
        setGisPending(null);
      }
    } else {
      // KML / ZIP: store pending, parse server-side on save
      setGisPreview({ name: file.name, pointCount: null });
    }
  };

  const clearGisFile = () => {
    setGisPending(null);
    setGisPreview(null);
    setGisError(null);
    if (gisInputRef.current) gisInputRef.current.value = '';
  };
  // ───────────────────────────────────────────────────────────────────────────

  const openEdit = (q) => {
    permitHistoryPagination.setPage(1);
    setForm({
      name: q.name, description: q.description || '', latitude: String(q.latitude), longitude: String(q.longitude),
      address: q.address || '', status: q.status, area_hectares: q.area_hectares ? String(q.area_hectares) : '',
      annual_allowable_volume_cubic_meters: q.annual_allowable_volume_cubic_meters !== null ? String(q.annual_allowable_volume_cubic_meters) : '',
      permit_number: q.permit_number || '', permit_issued_at: q.permit_issued_at || '',
    });
    setPolygon(q.polygon_coordinates || []);
    setEditId(q.id);
    setEditingQuarry(q);
    setShowRenewal(false);
    const latestPermit = q.permits?.[0];
    setRenewForm({
      permit_number: '',
      issued_at: latestPermit?.expires_at ? dayAfter(latestPermit.expires_at) : localDateString(),
      annual_allowable_volume_cubic_meters: '',
      document: null,
    });
    setShowEditor(false);
    clearGisFile();
    // Pre-fill preview from existing server file
    if (q.gis_file_name) setGisPreview({ name: q.gis_file_name, pointCount: (q.polygon_coordinates || []).length, serverUrl: q.gis_file_url });
    setModal('edit');
  };

  const permitBadge = (q) => {
    if (q.permit_status === 'expired') {
      return (
        <span className="badge badge-danger" title={`Expired on ${q.permit_expires_at}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', padding: '2px 7px' }}>
          <AlertTriangle size={11} /> Expired ({q.permit_expires_at})
        </span>
      );
    }
    if (q.permit_status === 'expiring_soon') {
      return (
        <span className="badge badge-warning" title={`Expires on ${q.permit_expires_at}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', padding: '2px 7px' }}>
          <Clock size={11} /> Expiring ({q.days_until_permit_expiration}d)
        </span>
      );
    }
    if (q.permit_status === 'not_started') {
      return (
        <span className="badge badge-warning" title={`Starts on ${q.permit_issued_at}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', padding: '2px 7px' }}>
          <Clock size={11} /> Starts ({q.permit_issued_at})
        </span>
      );
    }
    if (q.permit_status === 'active') {
      return (
        <span className="badge badge-success" title={`Expires on ${q.permit_expires_at}`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
          Valid ({q.permit_expires_at})
        </span>
      );
    }
    return <span className="text-muted text-xs">—</span>;
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    const { permit_number, permit_issued_at, annual_allowable_volume_cubic_meters, ...quarryForm } = form;
    const payload = {
      ...(modal === 'create' ? form : quarryForm),
      latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude),
      area_hectares: form.area_hectares ? parseFloat(form.area_hectares) : null,
      ...(modal === 'create' ? {
        permit_number,
        permit_issued_at,
        annual_allowable_volume_cubic_meters: annual_allowable_volume_cubic_meters ? parseFloat(annual_allowable_volume_cubic_meters) : null,
      } : {}),
      polygon_coordinates: polygon.length >= 3 ? polygon : null,
    };
    try {
      if (modal === 'edit') {
        await updateQuarry(editId, payload);
        // Upload pending GIS file if any (edit: quarry already exists)
        if (gisPending) {
          setGisUploading(true);
          try { await uploadGisFile(editId, gisPending); } catch { toast.error('GIS file upload failed'); }
          setGisUploading(false);
        }
        toast.success('Quarry updated');
      } else {
        const res = await createQuarry(payload);
        const newId = res.data.quarry.id;
        // Upload GIS file after creation
        if (gisPending && newId) {
          setGisUploading(true);
          try { await uploadGisFile(newId, gisPending); } catch { toast.error('GIS file upload failed'); }
          setGisUploading(false);
        }
        toast.success('Quarry created');
      }
      setModal(null); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); } finally { setSaving(false); }
  };

  const handleRenewPermit = async () => {
    if (!renewForm.permit_number.trim() || !renewForm.issued_at) {
      toast.error('Permit number and issue date are required');
      return;
    }

    setRenewSaving(true);
    try {
      await createQuarryPermit(editId, renewForm);
      const response = await getQuarry(editId);
      const refreshed = response.data.quarry;
      setEditingQuarry(refreshed);
      setForm((current) => ({
        ...current,
        permit_number: refreshed.permit_number || '',
        permit_issued_at: refreshed.permit_issued_at || '',
        annual_allowable_volume_cubic_meters: refreshed.annual_allowable_volume_cubic_meters !== null
          ? String(refreshed.annual_allowable_volume_cubic_meters)
          : '',
      }));
      setShowRenewal(false);
      setRenewForm({ permit_number: '', issued_at: '', annual_allowable_volume_cubic_meters: '', document: null });
      fetchData();
      toast.success('New permit term created');
    } catch (err) {
      const errors = err.response?.data?.errors;
      toast.error(errors ? Object.values(errors).flat()[0] : (err.response?.data?.message || 'Failed to renew permit'));
    } finally {
      setRenewSaving(false);
    }
  };

  const handleDeleteGisFile = async () => {
    if (!editId) { clearGisFile(); return; }
    try {
      await deleteGisFile(editId);
      clearGisFile();
      toast.success('GIS file removed');
      fetchData();
    } catch { toast.error('Failed to remove GIS file'); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete Quarry', message: 'Are you sure you want to delete this quarry?', confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    try { await deleteQuarry(id); toast.success('Deleted'); fetchData(); } catch { toast.error('Error'); }
  };

  // Map initialization when editor is shown
  useEffect(() => {
    if (!showEditor || !mapRef.current) return;

    const centerLng = parseFloat(form.longitude) || 121.3189;
    const centerLat = parseFloat(form.latitude) || 12.7567;

    const map = new maplibregl.Map({
      container: mapRef.current,
      maxPitch: 85,
      style: {
        version: 8,
        sources: {
          'osm-tiles': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 },
          'satellite-tiles': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 },
          'topo-tiles': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 },
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
          'draw-data': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        },
        layers: [
          { id: 'offline-background', type: 'background', paint: { 'background-color': '#E7EFE9' } },
          { id: 'base-street', type: 'raster', source: 'osm-tiles', layout: { visibility: 'visible' } },
          { id: 'base-satellite', type: 'raster', source: 'satellite-tiles', layout: { visibility: 'none' } },
          { id: 'base-topo', type: 'raster', source: 'topo-tiles', layout: { visibility: 'none' } },
          { id: 'hills', type: 'hillshade', source: 'hillshade-dem', layout: { visibility: 'visible' }, paint: { 'hillshade-exaggeration': 0.6 } },
          { id: 'poly-fill', type: 'fill', source: 'draw-data', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#0F766E', 'fill-opacity': 0.25 } },
          { id: 'poly-line', type: 'line', source: 'draw-data', filter: ['==', '$type', 'Polygon'], paint: { 'line-color': '#0F766E', 'line-width': 2.5 } },
          { id: 'poly-pts', type: 'circle', source: 'draw-data', filter: ['==', '$type', 'Point'], paint: { 'circle-color': '#0F766E', 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF' } },
        ],
      },
      center: [centerLng, centerLat],
      zoom: 15,
      pitch: 60,
      bearing: -15,
    });

    mapInstanceRef.current = map;

    map.on('load', () => {
      setMapObj(map);
      try {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
      } catch {
        // Terrain support is optional in browsers without WebGL elevation support.
      }
      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Click on map to add vertex to polygon
      map.on('click', (e) => {
        const { lat, lng } = e.lngLat;
        setPolygon(prev => [...prev, [parseFloat(lat.toFixed(7)), parseFloat(lng.toFixed(7))]]);
      });
    });

    return () => map.remove();
  }, [showEditor]);

  // Sync polygon state with map source — use ref to avoid mapObj null issue
  useEffect(() => {
    const m = mapInstanceRef.current;
    if (!m) return;

    const sync = () => {
      const features = [];
      polygon.forEach(pt => {
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [pt[1], pt[0]] } });
      });
      if (polygon.length >= 3) {
        const ring = polygon.map(pt => [pt[1], pt[0]]);
        ring.push(ring[0]);
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } });
      }
      const source = m.getSource('draw-data');
      if (source) source.setData({ type: 'FeatureCollection', features });
    };

    if (m.isStyleLoaded()) {
      sync();
    } else {
      m.once('load', sync);
    }
  }, [polygon]);

  const clearPolygon = () => setPolygon([]);
  const undoPoint = () => setPolygon(prev => prev.slice(0, -1));

  const statusBadge = (s) => {
    if (s === 'active') return <span className="badge badge-success">Active</span>;
    if (s === 'pending') return <span className="badge badge-warning" style={{ background: '#FEF3C7', color: '#D97706', fontWeight: 600 }}>Pending</span>;
    if (s === 'inactive') return <span className="badge badge-neutral">Inactive</span>;
    if (s === 'illegal') return <span className="badge badge-danger" style={{ background: '#FEE2E2', color: '#DC2626', fontWeight: 700 }}>⚠️ Illegal</span>;
    return <span className="badge badge-warning">{s}</span>;
  };

  return (
    <div className={`animate-fadeIn ${modal ? 'form-page-open' : ''}`}>
      <div className="page-header">
        <div><h1>Quarries</h1><p>Manage quarry sites, personnel, and boundaries</p></div>
        <div className="flex gap-2 items-center no-print">
          <AdminPageActions />
          <button className="btn btn-primary" onClick={() => navigate('/?addQuarry=application')}><Plus size={18} /> Add Quarry</button>
        </div>
      </div>
      <div className="filters-bar" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <form className="search-input" onSubmit={(e) => { e.preventDefault(); fetchData(); }} style={{ flex: 1 }}>
          <Search className="search-icon" /><input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </form>
        <SearchableSelect
          id="quarry-permit-filter"
          value={permitFilter}
          onChange={setPermitFilter}
          options={[
            { value: '', label: 'All Permit Statuses' },
            { value: 'expired', label: '🔴 Expired' },
            { value: 'expiring_soon', label: '🟡 Expiring Soon (≤30d)' },
            { value: 'active', label: '🟢 Active / Valid' },
          ]}
          ariaLabel="Filter quarries by permit status"
          containerStyle={{ width: 210 }}
          style={{ fontSize: '0.8125rem' }}
        />
      </div>
      <div className="tabs-container" role="tablist" aria-label="Filter quarries by status">
        {quarryStatusTabs.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.value}
            className={`tab-btn ${statusFilter === tab.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(tab.value)}
          >
            <span
              aria-hidden="true"
              style={{ display: 'inline-block', width: 8, height: 8, marginRight: 7, borderRadius: '50%', background: tab.color }}
            />
            {tab.label}
          </button>
        ))}
      </div>
      <div className="table-container">
        {loading ? <div className="loader-container"><div className="spinner" /></div> : (
          <table className="table">
            <thead><tr><th>Permittee Name</th><th>Address</th><th>Status</th><th>Annual Allowable</th><th>Boundary</th><th>GIS File</th><th>Operator</th><th>Staff</th><th>Permit No. &amp; Status</th><th style={{ width: 100 }}>Actions</th></tr></thead>
            <tbody>
              {quarries.map(q => (
                <tr
                  key={q.id}
                  className="quarry-list-row"
                  onClick={() => navigate(`/quarry/${q.id}`)}
                  title={`Open ${q.name} on the map`}
                >
                  <td className="font-medium">
                    <Link className="quarry-name-link" to={`/quarry/${q.id}`} onClick={(event) => event.stopPropagation()}>{q.name}</Link>
                  </td>
                  <td className="text-muted text-sm">{q.address || 'Bongabong'}</td>
                  <td>{statusBadge(q.status)}</td>
                  <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>
                    {q.annual_allowable_volume_cubic_meters !== null
                      ? <>
                          <div>{Number(q.permit_term_consumed_volume_cubic_meters || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} / {Number(q.annual_allowable_volume_cubic_meters).toLocaleString(undefined, { maximumFractionDigits: 2 })} m³</div>
                          {q.permit_issued_at && <div className="text-muted" style={{ fontSize: '0.68rem' }}>{q.permit_issued_at} to {q.permit_expires_at}</div>}
                        </>
                      : <span className="text-muted text-xs">Not set</span>}
                  </td>
                  <td>
                    {q.polygon_coordinates?.length >= 3 ? (
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                        <Hexagon size={11} /> {q.area_hectares ? `${q.area_hectares} ha` : `${q.polygon_coordinates.length} pts`}
                      </span>
                    ) : <span className="text-muted text-xs">Point only</span>}
                  </td>
                  <td>
                    {q.gis_file_name ? (
                      <a
                        href={q.gis_file_url}
                        onClick={(event) => event.stopPropagation()}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
                        title={q.gis_file_name}
                      >
                        <FileJson size={12} />
                        <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.gis_file_name}</span>
                      </a>
                    ) : <span className="text-muted text-xs">—</span>}
                  </td>
                  <td>{q.operators?.[0] ? <span className="flex items-center gap-1 text-xs"><User size={12} className="text-teal-600" /> {q.operators[0].name}</span> : <span className="text-muted text-xs">None</span>}</td>
                  <td><span className="flex items-center gap-1 text-xs text-muted"><Users size={12} /> {q.staff_count || 0}</span></td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="text-xs font-mono font-medium">{q.permit_number || 'No permit #'}</span>
                      {permitBadge(q)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost btn-icon" onClick={(event) => { event.stopPropagation(); openEdit(q); }} title="Edit"><Edit2 size={15} /></button>
                      <button className="btn-ghost btn-icon text-danger" onClick={(event) => { event.stopPropagation(); handleDelete(q.id); }} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {quarries.length === 0 && <tr><td colSpan={10} className="text-center text-muted" style={{ padding: 40 }}>No quarries found</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} onPageChange={setPage} />

      {modal && (
        <div className="full-page-form">
          <div
            className="full-page-form-card"
            style={{
              maxWidth: showEditor ? 1100 : 760,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  {modal === 'create' ? 'Add New Quarry' : 'Edit Quarry'}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  {modal === 'create' ? 'Fill in the details and optionally draw a boundary on the map' : 'Update the quarry information below'}
                </p>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setModal(null)}><X size={18} /></button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>

                {/* Left: form fields */}
                <div style={{ flex: '1 1 520px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

                  {/* Permittee Name */}
                  <div className="form-group">
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Permittee Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Juan Dela Cruz" required />
                  </div>

                  {/* Permit Number + one-year permit term + annual allowance */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{modal === 'edit' ? 'Current Permit No.' : 'Permit No.'}</label>
                      <input className="form-input" value={form.permit_number} onChange={e => setForm({ ...form, permit_number: e.target.value })} placeholder="QP-2025-001" readOnly={modal === 'edit'} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{modal === 'edit' ? 'Current Permit Issued' : 'Permit Issued'}</label>
                      <input className="form-input" type="date" value={form.permit_issued_at} onChange={e => setForm({ ...form, permit_issued_at: e.target.value })} readOnly={modal === 'edit'} />
                      {form.permit_issued_at && (
                        <span className="text-muted" style={{ fontSize: '0.68rem', marginTop: 3 }}>
                          Expires: {permitExpiryFromIssueDate(form.permit_issued_at)}
                        </span>
                      )}
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Annual Allowable (m³/year)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.annual_allowable_volume_cubic_meters}
                        onChange={e => setForm({ ...form, annual_allowable_volume_cubic_meters: e.target.value })}
                        placeholder="e.g. 25,000"
                        readOnly={modal === 'edit'}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="quarry-status" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</label>
                      <SearchableSelect
                        id="quarry-status"
                        value={form.status}
                        onChange={(status) => setForm({ ...form, status })}
                        options={[
                          { value: 'active', label: 'Active' },
                          { value: 'pending', label: 'Pending Review' },
                          { value: 'inactive', label: 'Inactive' },
                          { value: 'suspended', label: 'Suspended' },
                          { value: 'illegal', label: 'Illegal (Unauthorized)' },
                        ]}
                      />
                    </div>
                  </div>

                  {modal === 'edit' && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, background: 'var(--bg-secondary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700 }}>Permit History</p>
                          <p className="text-muted" style={{ margin: '2px 0 0', fontSize: '0.7rem' }}>Renewals create a new term and preserve previous consumption.</p>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowRenewal((value) => !value)}>
                          <Plus size={14} /> {editingQuarry?.permits?.length ? 'Renew Permit' : 'Add Permit'}
                        </button>
                      </div>

                      {showRenewal && (
                        <div style={{ padding: 12, border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', marginBottom: 12 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
                            <div className="form-group">
                              <label className="form-label">New Permit No. *</label>
                              <input className="form-input" value={renewForm.permit_number} onChange={(e) => setRenewForm({ ...renewForm, permit_number: e.target.value })} placeholder="QP-2027-001" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Issue Date *</label>
                              <input className="form-input" type="date" value={renewForm.issued_at} onChange={(e) => setRenewForm({ ...renewForm, issued_at: e.target.value })} />
                              {renewForm.issued_at && <span className="text-muted" style={{ fontSize: '0.68rem' }}>Expires: {permitExpiryFromIssueDate(renewForm.issued_at)}</span>}
                            </div>
                            <div className="form-group">
                              <label className="form-label">Annual Allowable (m³)</label>
                              <input className="form-input" type="number" min="0" step="0.01" value={renewForm.annual_allowable_volume_cubic_meters} onChange={(e) => setRenewForm({ ...renewForm, annual_allowable_volume_cubic_meters: e.target.value })} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Permit Document</label>
                              <input className="form-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setRenewForm({ ...renewForm, document: e.target.files?.[0] || null })} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRenewal(false)}>Cancel</button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={handleRenewPermit} disabled={renewSaving}>
                              {renewSaving ? 'Saving…' : 'Create Permit Term'}
                            </button>
                          </div>
                        </div>
                      )}

                      {editingQuarry?.permits?.length ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="table" style={{ margin: 0 }}>
                            <thead><tr><th>Permit</th><th>Term</th><th>Allowance</th><th>Used / Committed</th><th>Status</th><th>File</th></tr></thead>
                            <tbody>
                              {permitHistoryPagination.pageItems.map((permit) => (
                                <tr key={permit.id}>
                                  <td className="font-medium">{permit.permit_number}</td>
                                  <td className="text-xs" style={{ whiteSpace: 'nowrap' }}>{permit.issued_at}<br />to {permit.expires_at}</td>
                                  <td>{permit.annual_allowable_volume_cubic_meters !== null ? `${Number(permit.annual_allowable_volume_cubic_meters).toLocaleString()} m³` : '—'}</td>
                                  <td>{Number(permit.consumed_volume_cubic_meters || 0).toLocaleString()} / {Number(permit.committed_volume_cubic_meters || 0).toLocaleString()} m³</td>
                                  <td><span className={`badge ${permit.effective_status === 'active' ? 'badge-success' : permit.effective_status === 'expired' ? 'badge-danger' : 'badge-warning'}`}>{permit.effective_status.replace('_', ' ')}</span></td>
                                  <td>{permit.document_url ? <a href={permit.document_url} target="_blank" rel="noopener noreferrer" title="Open permit document"><FileText size={15} /></a> : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <Pagination meta={permitHistoryPagination.meta} onPageChange={permitHistoryPagination.setPage} />
                        </div>
                      ) : <p className="text-muted text-sm" style={{ margin: 0 }}>No permit terms recorded yet.</p>}
                    </div>
                  )}

                  {/* Address */}
                  <div className="form-group">
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Address / Barangay</label>
                    <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Brgy. Aplaya, Bongabong, Oriental Mindoro" />
                  </div>

                  {/* Description */}
                  <div className="form-group">
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                    <textarea className="form-textarea" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the quarry site..." style={{ minHeight: 64, resize: 'vertical' }} />
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Location</p>

                    {/* Lat + Lng row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div className="form-group">
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Latitude <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input className="form-input" type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="12.7567" required />
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Longitude <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input className="form-input" type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="121.3189" required />
                      </div>
                    </div>

                    {/* Area + Draw Boundary row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Area (Hectares)</label>
                        <input className="form-input" type="number" step="any" value={form.area_hectares} onChange={e => setForm({ ...form, area_hectares: e.target.value })} placeholder="Auto-calculated" />
                      </div>
                      <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Boundary</label>
                        <button
                          type="button"
                          onClick={() => setShowEditor(!showEditor)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '10px 14px', borderRadius: 'var(--radius-md)',
                            border: showEditor ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                            background: showEditor ? 'var(--primary-100)' : 'var(--bg-primary)',
                            color: showEditor ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', width: '100%',
                            transition: 'all 0.15s',
                          }}
                        >
                          <Hexagon size={15} />
                          {showEditor ? 'Hide Map' : polygon.length >= 3 ? `${polygon.length} pts drawn` : 'Draw Boundary'}
                        </button>
                      </div>
                    </div>

                    {/* GIS File Upload */}
                    <div style={{ marginTop: 4 }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                        Import GIS File
                        <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>(GeoJSON, KML, Shapefile ZIP)</span>
                      </label>

                      {/* Dropzone */}
                      {!gisPreview ? (
                        <div
                          onClick={() => gisInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleGisFile(f); }}
                          style={{
                            border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '14px 12px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: isDragOver ? 'var(--primary-50)' : 'var(--bg-secondary)',
                            transition: 'all 0.15s',
                          }}
                        >
                          <Upload size={18} style={{ margin: '0 auto 6px', color: 'var(--text-tertiary)', display: 'block' }} />
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Click to browse</span> or drag & drop
                          </p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 3 }}>.geojson · .kml · .zip (max 10 MB)</p>
                        </div>
                      ) : (
                        /* Preview card once a file is selected */
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1.5px solid var(--primary-100)',
                          background: 'var(--primary-50)',
                        }}>
                          <FileJson size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '0.78rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {gisPreview.name}
                            </p>
                            {gisPreview.pointCount !== null && (
                              <p style={{ fontSize: '0.7rem', color: 'var(--primary)', margin: '2px 0 0', fontWeight: 500 }}>
                                ✓ {gisPreview.pointCount} boundary points parsed
                                {form.area_hectares ? ` · ${form.area_hectares} ha` : ''}
                              </p>
                            )}
                            {gisPreview.serverUrl && !gisPending && (
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Saved on server</p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn-ghost btn-icon text-danger"
                            style={{ padding: 4, flexShrink: 0 }}
                            onClick={handleDeleteGisFile}
                            title="Remove GIS file"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      {/* Hidden file input */}
                      <input
                        ref={gisInputRef}
                        type="file"
                        accept=".geojson,.json,.kml,.zip"
                        style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files[0]; if (f) handleGisFile(f); }}
                      />

                      {/* Error */}
                      {gisError && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '0.75rem', color: 'var(--danger)' }}>
                          <AlertCircle size={13} /> {gisError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Map editor */}
                {showEditor && (
                  <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Map toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Click map to add boundary points
                        {polygon.length > 0 && (
                          <span style={{ marginLeft: 6, padding: '2px 8px', background: 'var(--primary-100)', color: 'var(--primary)', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700 }}>
                            {polygon.length} pts
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn-ghost btn-icon" onClick={undoPoint} disabled={polygon.length === 0} title="Undo last point" style={{ padding: 6 }}><Undo2 size={14} /></button>
                        <button type="button" className="btn-ghost btn-icon text-danger" onClick={clearPolygon} disabled={polygon.length === 0} title="Clear all points" style={{ padding: 6 }}><Trash2 size={14} /></button>
                      </div>
                    </div>

                    {/* Map container */}
                    <div style={{ position: 'relative', flex: 1, minHeight: 320, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: '#e2e8f0' }}>
                      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>
                        <MapLayerControl map={mapObj} mapRef={mapInstanceRef} is3D={is3D} setIs3D={setIs3D} />
                      </div>
                    </div>

                    {polygon.length >= 3 && (
                      <div style={{ padding: '8px 12px', background: 'var(--primary-50)', border: '1px solid var(--primary-100)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', color: 'var(--primary-700)' }}>
                        ✓ Boundary set — {form.area_hectares ? `${form.area_hectares} ha` : `${polygon.length} points`}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                flexShrink: 0,
                background: 'var(--bg-secondary)',
              }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || gisUploading}>
                  {gisUploading ? 'Uploading GIS...' : saving ? 'Saving...' : modal === 'create' ? 'Create Quarry' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
