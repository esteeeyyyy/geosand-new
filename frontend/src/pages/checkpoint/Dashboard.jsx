import { useEffect, useState, useRef } from 'react';
import { getPendingRecords, verifyRecord, directVerifyRecord, getCheckpoints } from '../../api/checkpoints';
import { getQuarries } from '../../api/quarries';
import { CheckCircle, XCircle, X, ClipboardCheck, Clock, Camera, Trash2, PlusCircle, Truck, FileText, MapPin } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination';
import SearchableSelect from '../../components/SearchableSelect';

export default function CheckpointDashboard() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'direct'

  // Data state
  const [records, setRecords] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [quarries, setQuarries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);

  // Modal for pending verification
  const [modal, setModal] = useState(null); // { record, action: 'verified'|'rejected' }
  const [remarks, setRemarks] = useState('');
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Permit photo state for modal
  const [permitPhoto, setPermitPhoto]     = useState(null);
  const [permitPreview, setPermitPreview] = useState(null);
  const cameraInputRef  = useRef(null);
  const galleryInputRef = useRef(null);

  // Direct On-the-Spot Form State
  const [directForm, setDirectForm] = useState({
    quarry_id: '',
    truck_plate_number: '',
    volume_cubic_meters: '',
    material_type: 'Fine Sand',
    destination: '',
    driver_name: '',
    notes: '',
    checkpoint_id: '',
    status: 'verified',
    remarks: '',
  });
  const [directPhoto, setDirectPhoto]     = useState(null);
  const [directPreview, setDirectPreview] = useState(null);
  const [directSubmitting, setDirectSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const directSubmittingRef = useRef(false);
  const directCameraRef  = useRef(null);
  const directGalleryRef = useRef(null);

  const fetchData = (p = page) => {
    setLoading(true);
    Promise.all([
      getPendingRecords({ page: p, per_page: 10 }),
      getCheckpoints({ per_page: 100 }),
      getQuarries({ per_page: 100 }),
    ])
      .then(([recordsRes, checkpointsRes, quarriesRes]) => {
        setRecords(recordsRes.data.hauling_records || []);
        setMeta(recordsRes.data.meta);
        const activeCps = (checkpointsRes.data.checkpoints || []).filter((c) => c.is_active);
        setCheckpoints(activeCps);

        const loadedQuarries = quarriesRes.data.quarries || [];
        setQuarries(loadedQuarries);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]);
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Handle Photo for Pending Modal
  const openAction = (record, action) => {
    setModal({ record, action });
    setRemarks('');
    setSelectedCheckpoint(checkpoints[0]?.id?.toString() || '');
    setPermitPhoto(null);
    setPermitPreview(null);
    if (cameraInputRef.current)  cameraInputRef.current.value  = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handlePhoto = (file) => {
    if (!file) return;
    setPermitPhoto(file);
    const reader = new FileReader();
    reader.onload = (e) => setPermitPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPermitPhoto(null);
    setPermitPreview(null);
    if (cameraInputRef.current)  cameraInputRef.current.value  = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!selectedCheckpoint) { toast.error('Select a checkpoint'); return; }
    if (modal.action === 'rejected' && !remarks.trim()) { toast.error('Remarks are required when rejecting'); return; }

    const isVerify = modal.action === 'verified';
    const ok = await confirm({
      title: isVerify ? 'Verify Record' : 'Reject Record',
      message: `Are you sure you want to ${isVerify ? 'verify' : 'reject'} hauling record ${modal.record.tracking_code}?`,
      confirmText: isVerify ? 'Verify' : 'Reject',
      type: isVerify ? 'success' : 'danger',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      await verifyRecord(modal.record.id, {
        checkpoint_id: parseInt(selectedCheckpoint),
        status: modal.action,
        remarks: remarks || null,
        permit_photo: permitPhoto || null,
      });
      toast.success(`Record ${modal.action} successfully`);
      setModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error processing verification');
    } finally {
      setSubmitting(false);
    }
  };

  // Direct On-The-Spot Form Handlers
  const handleDirectPhoto = (file) => {
    if (!file) return;
    setDirectPhoto(file);
    const reader = new FileReader();
    reader.onload = (e) => setDirectPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const clearDirectPhoto = () => {
    setDirectPhoto(null);
    setDirectPreview(null);
    if (directCameraRef.current)  directCameraRef.current.value  = '';
    if (directGalleryRef.current) directGalleryRef.current.value = '';
  };

  const handleDirectSubmit = async (e) => {
    e.preventDefault();
    if (directSubmittingRef.current) return;
    if (!directForm.quarry_id) { toast.error('Please select a permittee'); return; }
    if (!directForm.truck_plate_number.trim()) { toast.error('Truck plate number is required'); return; }
    if (!directForm.volume_cubic_meters || parseFloat(directForm.volume_cubic_meters) <= 0) {
      toast.error('Valid volume in m³ is required'); return;
    }
    if (!directForm.destination.trim()) { toast.error('Destination is required'); return; }
    if (!directForm.checkpoint_id) { toast.error('Please select a checkpoint station'); return; }
    if (directForm.status === 'rejected' && !directForm.remarks.trim()) {
      toast.error('Remarks are required when rejecting'); return;
    }

    const isVerify = directForm.status === 'verified';
    const ok = await confirm({
      title: isVerify ? 'Confirm Direct Verification' : 'Confirm Direct Rejection',
      message: `Log and ${isVerify ? 'verify' : 'reject'} hauling for truck ${directForm.truck_plate_number.toUpperCase()} on the spot?`,
      confirmText: isVerify ? 'Verify & Log' : 'Reject & Log',
      type: isVerify ? 'success' : 'danger',
    });
    if (!ok) return;

    directSubmittingRef.current = true;
    setDirectSubmitting(true);
    try {
      await directVerifyRecord({
        ...directForm,
        permit_photo: directPhoto || null,
      });
      toast.success(`Hauling record logged & ${directForm.status} on the spot!`);
      // Reset form
      setDirectForm((prev) => ({
        ...prev,
        quarry_id: '',
        checkpoint_id: '',
        truck_plate_number: '',
        volume_cubic_meters: '',
        destination: '',
        driver_name: '',
        notes: '',
        remarks: '',
      }));
      clearDirectPhoto();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit direct verification');
    } finally {
      directSubmittingRef.current = false;
      setDirectSubmitting(false);
    }
  };

  const isVerify = modal?.action === 'verified';

  return (
    <div className={`animate-fadeIn ${modal ? 'form-page-open' : ''}`}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Checkpoint Verification</h1>
          <p>Verify pre-submitted records or log unannounced haulings on the spot</p>
        </div>
        <div className="badge badge-warning" style={{ fontSize: '0.875rem', padding: '6px 14px' }}>
          <Clock size={16} /> {records.length} Pending Pre-submissions
        </div>
      </div>

      {/* Tabs */}
      <div className="mobile-scroll-tabs checkpoint-verification-tabs" style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <button
          className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pending')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}
        >
          <Clock size={18} /> Pending Pre-submissions ({records.length})
        </button>
        <button
          className={`btn ${activeTab === 'direct' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('direct')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}
        >
          <PlusCircle size={18} /> On-the-Spot / Direct Entry
        </button>
      </div>

      {/* ── TAB 1: PENDING QUEUE ── */}
      {activeTab === 'pending' && (
        <>
          {loading ? (
            <div className="loader-container"><div className="spinner" /></div>
          ) : records.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <ClipboardCheck size={48} style={{ color: 'var(--gray-300)', marginBottom: 16 }} />
                <h3>No Pending Pre-submissions</h3>
                <p>No operator pre-submitted hauling records awaiting verification.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {records.map((r) => (
                <div key={r.id} className="card" style={{ transition: 'all 0.2s' }}>
                  <div className="card-body">
                    <div className="flex items-center justify-between mobile-card-heading" style={{ marginBottom: 12 }}>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 600, color: 'var(--primary)' }}>{r.tracking_code}</span>
                        <span className="badge badge-warning" style={{ marginLeft: 12 }}>pending</span>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-primary btn-sm" onClick={() => openAction(r, 'verified')}>
                          <CheckCircle size={16} /> Verify
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => openAction(r, 'rejected')}>
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </div>
                    <div className="grid-4" style={{ fontSize: '0.875rem' }}>
                      <div><span className="text-muted">Permittee Name:</span><br /><strong>{r.quarry?.name}</strong></div>
                      <div><span className="text-muted">Operator:</span><br /><strong>{r.operator?.name}</strong></div>
                      <div><span className="text-muted">Volume:</span><br /><strong>{r.volume_cubic_meters} m³</strong></div>
                      <div><span className="text-muted">Truck:</span><br /><strong>{r.truck_plate_number}</strong></div>
                    </div>
                    <div className="grid-3 mt-2" style={{ fontSize: '0.875rem' }}>
                      <div><span className="text-muted">Material:</span> {r.material_type}</div>
                      <div><span className="text-muted">Destination:</span> {r.destination}</div>
                      <div><span className="text-muted">Date:</span> {new Date(r.hauled_at).toLocaleString()}</div>
                    </div>
                    {r.notes && <p className="text-sm text-muted mt-2">Notes: {r.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}

      {/* ── TAB 2: DIRECT ON-THE-SPOT ENTRY ── */}
      {activeTab === 'direct' && (
        <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={20} className="text-primary" /> On-the-Spot Hauling Verification
            </h3>
            <p className="text-sm text-muted">
              Log and verify an unannounced truck directly at the checkpoint station.
            </p>
          </div>
          <div className="card-body">
            <form onSubmit={handleDirectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div className="grid-2">
                {/* Permittee */}
                <div className="form-group">
                  <label className="form-label" htmlFor="direct-quarry-source">Permittee Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <SearchableSelect
                    id="direct-quarry-source"
                    value={directForm.quarry_id}
                    options={quarries.map((quarry) => ({ value: quarry.id, label: quarry.name }))}
                    onChange={(quarryId) => setDirectForm({ ...directForm, quarry_id: quarryId })}
                    placeholder="Select Permittee..."
                    searchPlaceholder="Search permittees..."
                    emptyMessage="No matching permittee found."
                    required
                  />
                </div>

                {/* Checkpoint Station */}
                <div className="form-group">
                  <label className="form-label" htmlFor="direct-checkpoint-station">Checkpoint Station <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <SearchableSelect
                    id="direct-checkpoint-station"
                    value={directForm.checkpoint_id}
                    options={checkpoints.map((checkpoint) => ({ value: checkpoint.id, label: checkpoint.name }))}
                    onChange={(checkpointId) => setDirectForm({ ...directForm, checkpoint_id: checkpointId })}
                    placeholder="Select Checkpoint..."
                    searchPlaceholder="Search checkpoints..."
                    emptyMessage="No matching checkpoint found."
                    required
                  />
                </div>
              </div>

              <div className="grid-3">
                {/* Truck Plate */}
                <div className="form-group">
                  <label className="form-label">Truck Plate No. <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ABC-1234"
                    value={directForm.truck_plate_number}
                    onChange={(e) => setDirectForm({ ...directForm, truck_plate_number: e.target.value })}
                    required
                  />
                </div>

                {/* Volume */}
                <div className="form-group">
                  <label className="form-label">Volume (m³) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="form-input"
                    placeholder="e.g. 15.0"
                    value={directForm.volume_cubic_meters}
                    onChange={(e) => setDirectForm({ ...directForm, volume_cubic_meters: e.target.value })}
                    required
                  />
                </div>

                {/* Material */}
                <div className="form-group">
                  <label className="form-label" htmlFor="direct-material-type">Material Type <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <SearchableSelect
                    id="direct-material-type"
                    value={directForm.material_type}
                    onChange={(materialType) => setDirectForm({ ...directForm, material_type: materialType })}
                    options={['Fine Sand', 'Coarse Sand', 'Gravel', 'Boulders', 'Mixed Aggregates'].map((type) => ({ value: type, label: type }))}
                    required
                  />
                </div>
              </div>

              <div className="grid-3">
                {/* Direct entries use the server's real-time submission timestamp. */}
                <div className="form-group">
                  <label className="form-label" htmlFor="direct-hauling-date">Hauling Date &amp; Time</label>
                  <input
                    id="direct-hauling-date"
                    type="text"
                    className="form-input"
                    value={currentTime.toLocaleString()}
                    readOnly
                    aria-label="Current hauling date and time"
                  />
                  <span className="text-muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>Recorded automatically when submitted</span>
                </div>

                {/* Destination */}
                <div className="form-group">
                  <label className="form-label">Destination <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Brgy. Central Construction Site"
                    value={directForm.destination}
                    onChange={(e) => setDirectForm({ ...directForm, destination: e.target.value })}
                    required
                  />
                </div>

                {/* Driver Name */}
                <div className="form-group">
                  <label className="form-label">Driver Name <span className="text-muted">(optional)</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Juan Cruz"
                    value={directForm.driver_name}
                    onChange={(e) => setDirectForm({ ...directForm, driver_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Remarks */}
              <div className="form-group">
                <label className="form-label">
                  Inspection Remarks {directForm.status === 'rejected' ? <span style={{ color: 'var(--danger)' }}>*</span> : <span className="text-muted">(optional)</span>}
                </label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder={directForm.status === 'rejected' ? 'State reason for rejection (e.g. over-capacity, expired permit)' : 'Optional physical inspection notes...'}
                  value={directForm.remarks}
                  onChange={(e) => setDirectForm({ ...directForm, remarks: e.target.value })}
                  required={directForm.status === 'rejected'}
                />
              </div>

              {/* Permit / Cargo Photo */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Camera size={16} /> Permit / Cargo Photo <span className="text-muted">(optional)</span>
                </label>
                {!directPreview ? (
                  <div style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                  }}>
                    <button
                      type="button"
                      onClick={() => directCameraRef.current?.click()}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '10px 22px', borderRadius: 'var(--radius-md)',
                        background: 'var(--primary)', color: '#fff',
                        border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                      }}
                    >
                      <Camera size={18} /> Take Photo
                    </button>
                    <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      or{' '}
                      <button
                        type="button"
                        onClick={() => directGalleryRef.current?.click()}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--primary)', fontWeight: 600, fontSize: '0.75rem', padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        choose from gallery
                      </button>
                    </p>
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
                    <img src={directPreview} alt="Cargo photo" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={clearDirectPhoto}
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 99,
                        color: '#fff', cursor: 'pointer', padding: '4px 8px', fontSize: '0.72rem',
                      }}
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                )}
                <input
                  ref={directCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files[0]; if (f) handleDirectPhoto(f); }}
                />
                <input
                  ref={directGalleryRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files[0]; if (f) handleDirectPhoto(f); }}
                />
              </div>

              {/* Verification Decision — final form action */}
              <div className="form-group">
                <label className="form-label">Verification Decision <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div className="verification-decision-actions" style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    className={`btn ${directForm.status === 'verified' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px' }}
                    onClick={() => setDirectForm({ ...directForm, status: 'verified' })}
                  >
                    <CheckCircle size={18} /> Approve / Verified
                  </button>
                  <button
                    type="button"
                    className={`btn ${directForm.status === 'rejected' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px' }}
                    onClick={() => setDirectForm({ ...directForm, status: 'rejected' })}
                  >
                    <XCircle size={18} /> Reject / Non-Compliant
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`btn ${directForm.status === 'verified' ? 'btn-primary' : 'btn-danger'}`}
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px' }}
                disabled={directSubmitting}
              >
                {directSubmitting ? (
                  'Processing…'
                ) : directForm.status === 'verified' ? (
                  <><CheckCircle size={18} /> Verify &amp; Log Direct Entry</>
                ) : (
                  <><XCircle size={18} /> Reject &amp; Log Direct Entry</>
                )}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* ── VERIFY / REJECT MODAL FOR PENDING QUEUE ── */}
      {modal && (
        <div className="full-page-form">
          <div className="full-page-form-card" style={{ maxWidth: 820 }}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>{isVerify ? 'Verify' : 'Reject'} Record</h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Tracking: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{modal.record.tracking_code}</span>
                </p>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setModal(null)}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="verification-checkpoint">Checkpoint <span style={{ color: 'var(--danger)' }}>*</span></label>
                <SearchableSelect
                  id="verification-checkpoint"
                  value={selectedCheckpoint}
                  onChange={setSelectedCheckpoint}
                  options={checkpoints.map((checkpoint) => ({ value: checkpoint.id, label: checkpoint.name }))}
                  placeholder="Select Checkpoint..."
                  searchPlaceholder="Search checkpoints..."
                  emptyMessage="No checkpoint found."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Remarks {modal.action === 'rejected' ? <span style={{ color: 'var(--danger)' }}>*</span> : <span className="text-muted">(optional)</span>}
                </label>
                <textarea
                  className="form-textarea"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder={modal.action === 'rejected' ? 'Reason for rejection...' : 'Optional remarks...'}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Camera size={14} /> Permit Photo <span className="text-muted">(optional)</span>
                </label>

                {!permitPreview ? (
                  <div style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                  }}>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '10px 22px', borderRadius: 'var(--radius-md)',
                        background: 'var(--primary)', color: '#fff',
                        border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                      }}
                    >
                      <Camera size={18} /> Take Photo
                    </button>
                    <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      or{' '}
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--primary)', fontWeight: 600, fontSize: '0.75rem', padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        choose from gallery
                      </button>
                    </p>
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
                    <img src={permitPreview} alt="Permit preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={clearPhoto}
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 99,
                        color: '#fff', cursor: 'pointer', padding: '4px 8px', fontSize: '0.72rem',
                      }}
                    >
                      <Trash2 size={12} /> Retake
                    </button>
                  </div>
                )}

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files[0]; if (f) handlePhoto(f); }}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files[0]; if (f) handlePhoto(f); }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button
                className={`btn ${isVerify ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Processing…' : isVerify ? 'Confirm Verification' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
