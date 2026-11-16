import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createHaulingRecord, createStaffHaulingRecord, updateStaffVehicleLocation, updateVehicleLocation } from '../../api/hauling';
import { Send, CheckCircle, ArrowLeft, Mountain, LocateFixed, Radio, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../../context/ConfirmContext';
import toast from 'react-hot-toast';
import SearchableSelect from '../../components/SearchableSelect';

export default function NewHauling() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const isStaff = user?.role === 'quarry_staff';
  const [form, setForm] = useState({
    truck_plate_number: '', volume_cubic_meters: '',
    material_type: 'Sand', destination: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const watchRef = useRef(null);
  const lastSentRef = useRef(0);
  const quarryRestricted = ['illegal', 'inactive', 'pending', 'suspended'].includes(user?.quarry?.status)
    || ['none', 'expired', 'not_started', 'suspended', 'cancelled'].includes(user?.quarry?.permit_status);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
  }, []);

  const stopLocationSharing = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setSharingLocation(false);
    setLocationStatus('Location sharing stopped');
  };

  const startLocationSharing = () => {
    if (!result?.id || !navigator.geolocation) {
      toast.error('GPS location is not available on this device');
      return;
    }
    const updateLocation = isStaff ? updateStaffVehicleLocation : updateVehicleLocation;
    setSharingLocation(true);
    setLocationStatus('Requesting GPS permission…');
    watchRef.current = navigator.geolocation.watchPosition(async (position) => {
      if (Date.now() - lastSentRef.current < 10000) return;
      lastSentRef.current = Date.now();
      try {
        await updateLocation(result.id, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          speed_kph: position.coords.speed == null ? null : position.coords.speed * 3.6,
          heading_degrees: position.coords.heading,
        });
        setLocationStatus(`GPS updated at ${new Date().toLocaleTimeString()} · ±${Math.round(position.coords.accuracy)} m`);
      } catch (error) {
        setLocationStatus(error.response?.data?.message || 'GPS update failed');
      }
    }, (error) => {
      setSharingLocation(false);
      setLocationStatus(error.message || 'Location permission was not granted');
      toast.error('Unable to share GPS location');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Submit Hauling Record',
      message: `Submit ${form.volume_cubic_meters} m³ of ${form.material_type} for permittee ${user?.quarry?.name || 'your assigned permittee'} to ${form.destination}?`,
      confirmText: 'Submit',
      type: 'success',
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      const submitFn = isStaff ? createStaffHaulingRecord : createHaulingRecord;
      const res = await submitFn({
        ...form,
        volume_cubic_meters: parseFloat(form.volume_cubic_meters),
      });
      setResult(res.data.hauling_record);
      toast.success('Hauling record created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create record');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center' }} className="animate-slideUp">
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle size={32} color="var(--success)" />
        </div>
        <h2>Record Submitted</h2>
        <p className="text-muted" style={{ margin: '8px 0 16px' }}>Your hauling record has been created and is pending verification.</p>
        <div className="card" style={{ textAlign: 'left', marginBottom: 24 }}>
          <div className="card-body">
            <div className="grid-2" style={{ gap: 16 }}>
              <div><p className="text-xs text-muted">Tracking Code</p><p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.125rem', color: 'var(--primary)' }}>{result.tracking_code}</p></div>
              <div><p className="text-xs text-muted">Volume</p><p className="font-medium">{result.volume_cubic_meters} m³</p></div>
              <div><p className="text-xs text-muted">Material</p><p className="font-medium">{result.material_type}</p></div>
              <div><p className="text-xs text-muted">Truck</p><p className="font-medium">{result.truck_plate_number}</p></div>
            </div>
          </div>
        </div>
        <div style={{ padding: 14, marginBottom: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: sharingLocation ? 'var(--primary-50)' : 'var(--bg-secondary)', textAlign: 'left' }}>
          <div className="flex items-center gap-2"><Radio size={17} style={{ color: sharingLocation ? 'var(--success)' : 'var(--text-tertiary)' }} /><strong className="text-sm">Vehicle GPS telemetry</strong>{sharingLocation && <span className="badge badge-success">Live</span>}</div>
          <p className="text-xs text-muted" style={{ margin: '5px 0 10px' }}>{locationStatus || 'Share this device’s location so MENRO can monitor the active hauling route in real time.'}</p>
          {sharingLocation
            ? <button className="btn btn-secondary btn-sm" onClick={stopLocationSharing}><Square size={14} /> Stop sharing</button>
            : <button className="btn btn-primary btn-sm" onClick={startLocationSharing}><LocateFixed size={14} /> Share live location</button>}
        </div>
        <div className="flex gap-2 justify-center">
          <button className="btn btn-primary" onClick={() => { stopLocationSharing(); setResult(null); setForm({ truck_plate_number: '', volume_cubic_meters: '', material_type: 'Sand', destination: '', notes: '' }); }}>
            New Record
          </button>
          <Link to={isStaff ? '/staff/history' : '/operator/history'} className="btn btn-secondary">View History</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }} className="animate-fadeIn">
      <Link to={isStaff ? '/staff/dashboard' : '/operator/dashboard'} className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>
      <div className="card">
        <div className="card-body">
          <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>New Hauling Record</h1>
          <p className="text-muted" style={{ marginBottom: 20 }}>Submit a new hauling record for verification</p>

          {quarryRestricted && <div style={{ padding: '12px 14px', marginBottom: 18, borderRadius: 'var(--radius-md)', border: '1px solid #FCA5A5', background: 'var(--danger-light)', color: '#991B1B', fontSize: '0.82rem' }}>
            <strong>Hauling access restricted.</strong> This site is inactive, unauthorized, suspended, or has an expired permit. Contact MENRO before submitting a delivery.
          </div>}

          {/* Auto-assigned permittee */}
          <div style={{ background: 'var(--primary-50)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mountain size={18} style={{ color: 'var(--primary)' }} />
            <div>
              <p className="text-xs text-muted">Assigned Permittee</p>
              <p className="font-medium text-sm">{user?.quarry?.name || 'Not assigned'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Truck Plate Number *</label>
                <input className="form-input" name="truck_plate_number" value={form.truck_plate_number} onChange={handleChange} placeholder="ABC 1234" required />
              </div>
              <div className="form-group">
                <label className="form-label">Volume (m³) *</label>
                <input className="form-input" type="number" step="0.01" name="volume_cubic_meters" value={form.volume_cubic_meters} onChange={handleChange} required />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="hauling-material-type">Material Type *</label>
                <SearchableSelect
                  id="hauling-material-type"
                  value={form.material_type}
                  onChange={(materialType) => setForm((current) => ({ ...current, material_type: materialType }))}
                  options={['Sand', 'Gravel', 'Fine Sand', 'Coarse Aggregate', 'Mixed Aggregate'].map((type) => ({ value: type, label: type }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date & Time</label>
                <div className="form-input" style={{ background: 'var(--gray-50)', color: 'var(--text-secondary)', cursor: 'default' }}>
                  {currentTime.toLocaleString()}
                </div>
                <span className="text-xs text-muted" style={{ marginTop: 4 }}>Auto-set to current time on submit</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Destination *</label>
              <input className="form-input" name="destination" value={form.destination} onChange={handleChange} placeholder="e.g. Calapan City" required />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange} rows={3} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || quarryRestricted}>
              <Send size={18} /> {submitting ? 'Submitting...' : 'Submit Record'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
