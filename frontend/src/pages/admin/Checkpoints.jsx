import { useEffect, useState } from 'react';
import { getCheckpoints, createCheckpoint, updateCheckpoint, deleteCheckpoint } from '../../api/checkpoints';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination';
import AdminPageActions from '../../components/AdminPageActions';
import SearchableSelect from '../../components/SearchableSelect';

const volumePeriods = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

const standardEarthTypes = [
  'Sand',
  'Fine Sand',
  'Fine Sand (Vibro)',
  'Coarse Sand',
  'Coarse Aggregate',
  'Mixed Aggregate',
  'Base Coarse (G-1)',
  'Gravel',
  'Gravel (3/4)',
  'River Sand (Unscreened)',
  'Crushed Rock (1/2)',
];

export default function AdminCheckpoints() {
  const confirm = useConfirm();
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name:'', latitude:'', longitude:'', address:'', is_active:true });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState('all');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [materialType, setMaterialType] = useState('');
  const [materialTypes, setMaterialTypes] = useState([]);
  const availableMaterialTypes = [...new Set([...standardEarthTypes, ...materialTypes])].sort();

  const fetchData = (p = page) => {
    if (period === 'custom' && (!customDates.start || !customDates.end)) return;
    const params = { page: p, per_page: 10, period, material_type: materialType || undefined };
    if (period === 'custom') {
      params.start_date = customDates.start;
      params.end_date = customDates.end;
    }
    setLoading(true);
    getCheckpoints(params)
      .then(r=>{
        setCheckpoints(r.data.checkpoints);
        setMeta(r.data.meta);
        setMaterialTypes(r.data.material_types || []);
      })
      .catch(console.error)
      .finally(()=>setLoading(false));
  };
  useEffect(() => { fetchData(); }, [page, period, customDates.start, customDates.end, materialType]);

  const openCreate = () => { setForm({ name:'', latitude:'12.7550', longitude:'121.3200', address:'', is_active:true }); setEditId(null); setModal('create'); };
  const openEdit = (c) => { setForm({ name:c.name, latitude:String(c.latitude), longitude:String(c.longitude), address:c.address||'', is_active:c.is_active }); setEditId(c.id); setModal('edit'); };

  const handleSubmit = async(e) => {
    e.preventDefault(); setSaving(true);
    const p = { ...form, latitude:parseFloat(form.latitude), longitude:parseFloat(form.longitude) };
    try {
      if(modal==='edit') { await updateCheckpoint(editId,p); toast.success('Updated'); }
      else { await createCheckpoint(p); toast.success('Created'); }
      setModal(null); fetchData();
    } catch(err) { toast.error('Error'); } finally { setSaving(false); }
  };

  const handleDelete = async(id) => {
    const ok = await confirm({ title: 'Delete Checkpoint', message: 'Are you sure you want to delete this checkpoint?', confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    try { await deleteCheckpoint(id); toast.success('Deleted'); fetchData(); } catch(e) { toast.error('Error'); }
  };

  return (
    <div className={`animate-fadeIn ${modal ? 'form-page-open' : ''}`}>
      <div className="page-header"><div><h1>Checkpoints</h1><p>Manage verification checkpoints</p></div>
        <div className="flex gap-2 items-center no-print">
          <AdminPageActions />
          <button className="btn btn-primary" onClick={openCreate}><Plus size={18}/> Add Checkpoint</button>
        </div>
      </div>
      <div className="filters-bar no-print" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div className="tabs-container" style={{ margin: 0 }} role="tablist" aria-label="Verified hauling volume period">
          {volumePeriods.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={period === tab.value}
              className={`tab-btn ${period === tab.value ? 'active' : ''}`}
              onClick={() => { setPeriod(tab.value); setPage(1); }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <SearchableSelect
          id="checkpoint-earth-type-filter"
          ariaLabel="Filter by earth type"
          value={materialType}
          onChange={(nextMaterialType) => { setMaterialType(nextMaterialType); setPage(1); }}
          options={[
            { value: '', label: 'All Earth Types' },
            ...availableMaterialTypes.map((type) => ({ value: type, label: type })),
          ]}
          searchPlaceholder="Search earth types..."
          containerStyle={{ width: 230 }}
        />
      </div>
      {period === 'custom' && (
        <div className="filters-bar date-range-filter no-print" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="text-sm font-medium filter-label">Custom range:</span>
          <input
            className="form-input"
            type="date"
            value={customDates.start}
            max={customDates.end || undefined}
            onChange={(event) => { setCustomDates((dates) => ({ ...dates, start: event.target.value })); setPage(1); }}
            style={{ width: 'auto' }}
          />
          <span className="text-muted filter-range-separator">to</span>
          <input
            className="form-input"
            type="date"
            value={customDates.end}
            min={customDates.start || undefined}
            onChange={(event) => { setCustomDates((dates) => ({ ...dates, end: event.target.value })); setPage(1); }}
            style={{ width: 'auto' }}
          />
        </div>
      )}
      <div className="table-container">
        {loading ? <div className="loader-container"><div className="spinner"/></div> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Address</th><th>Coordinates</th><th>Total Verified Volume</th><th>Status</th><th style={{width:100}}>Actions</th></tr></thead>
          <tbody>
            {checkpoints.map(c=>(
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-sm text-muted">{c.address||'—'}</td>
                <td className="text-xs" style={{fontFamily:'monospace'}}>{c.latitude}, {c.longitude}</td>
                <td className="font-medium">{Number(c.verified_volume_cubic_meters || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</td>
                <td><span className={`badge ${c.is_active?'badge-success':'badge-danger'}`}>{c.is_active?'Active':'Inactive'}</span></td>
                <td><div className="flex gap-1"><button className="btn-ghost btn-icon" onClick={()=>openEdit(c)}><Edit2 size={16}/></button><button className="btn-ghost btn-icon" style={{color:'var(--danger)'}} onClick={()=>handleDelete(c.id)}><Trash2 size={16}/></button></div></td>
              </tr>
            ))}
            {checkpoints.length===0 && <tr><td colSpan={6} className="text-center text-muted" style={{padding:40}}>No checkpoints</td></tr>}
          </tbody>
        </table>)}
      </div>
      <Pagination meta={meta} onPageChange={setPage} />

      {modal && (
        <div className="full-page-form">
          <div className="full-page-form-card">
            <div className="modal-header"><h2>{modal==='edit'?'Edit':'Add'} Checkpoint</h2><button className="btn-ghost btn-icon" onClick={()=>setModal(null)}><X size={20}/></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Latitude *</label><input className="form-input" type="number" step="any" value={form.latitude} onChange={e=>setForm({...form,latitude:e.target.value})} required/></div>
                  <div className="form-group"><label className="form-label">Longitude *</label><input className="form-input" type="number" step="any" value={form.longitude} onChange={e=>setForm({...form,longitude:e.target.value})} required/></div>
                </div>
                <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></div>
                <div className="form-group"><label className="form-label" style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Active</label></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':'Save'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
