import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Cpu, FileText, Mountain, Plus, Shield, TrendingUp, Truck, X } from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import { getAnalytics } from '../../api/analytics';
import { getQuarries } from '../../api/quarries';
import { createMonitoringRecord, getMonitoringRecords } from '../../api/monitoring';
import AdminPageActions from '../../components/AdminPageActions';
import Pagination from '../../components/Pagination';
import SearchableSelect from '../../components/SearchableSelect';
import useClientPagination from '../../hooks/useClientPagination';

const periods = [
  ['day', 'Today'], ['week', 'This week'], ['month', 'This month'], ['year', 'This year'], ['all', 'All Time'], ['custom', 'Custom'],
];

export default function MonitoringReports() {
  const [period, setPeriod] = useState('all');
  const [dates, setDates] = useState({ start: '', end: '' });
  const [data, setData] = useState(null);
  const [quarries, setQuarries] = useState([]);
  const [monitoringRecords, setMonitoringRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInspection, setShowInspection] = useState(false);
  const [savingInspection, setSavingInspection] = useState(false);
  const [inspection, setInspection] = useState({
    quarry_id: '', inspection_date: new Date().toISOString().slice(0, 10), excavation_depth_m: '', river_setback_m: '',
    air_quality_pm25: '', water_turbidity_ntu: '', noise_level_db: '', rehabilitated_area_ha: '', flood_risk: '',
    compliance_status: 'compliant', notes: '',
  });

  useEffect(() => {
    if (period === 'custom' && (!dates.start || !dates.end)) return;
    const params = { period };
    if (period === 'custom') Object.assign(params, { start_date: dates.start, end_date: dates.end });
    setLoading(true);
    Promise.all([getAnalytics(params), getQuarries({ per_page: 100 }), getMonitoringRecords({ per_page: 100 })])
      .then(([analytics, quarryResponse, monitoringResponse]) => {
        setData(analytics.data);
        setQuarries(quarryResponse.data.quarries || []);
        setMonitoringRecords(monitoringResponse.data.monitoring_records || []);
      })
      .catch(() => toast.error('Monitoring data could not be loaded'))
      .finally(() => setLoading(false));
  }, [period, dates.start, dates.end]);

  const saveInspection = async (event) => {
    event.preventDefault();
    setSavingInspection(true);
    try {
      const payload = Object.fromEntries(Object.entries(inspection).map(([key, value]) => [key, value === '' ? null : value]));
      await createMonitoringRecord(payload);
      toast.success('Field inspection recorded');
      setShowInspection(false);
      const analyticsParams = { period };
      if (period === 'custom') Object.assign(analyticsParams, { start_date: dates.start, end_date: dates.end });
      const [analytics, monitoringResponse] = await Promise.all([getAnalytics(analyticsParams), getMonitoringRecords({ per_page: 100 })]);
      setData(analytics.data);
      setMonitoringRecords(monitoringResponse.data.monitoring_records || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Inspection could not be saved');
    } finally {
      setSavingInspection(false);
    }
  };

  const forecastData = useMemo(() => {
    if (!data) return [];
    const history = (data.productivity_history || []).slice(-6).map((row) => ({ label: row.label, actual: Number(row.total_volume) }));
    const forecast = (data.predictive_analysis?.forecast_series || []).map((row) => ({
      label: row.month,
      forecast: Number(row.predicted_volume),
      lower: Number(row.lower_bound),
      upper: Number(row.upper_bound),
    }));
    return [...history, ...forecast];
  }, [data]);

  const permitSummary = useMemo(() => ({
    expired: quarries.filter((q) => q.permit_status === 'expired').length,
    expiring: quarries.filter((q) => q.permit_status === 'expiring_soon').length,
    valid: quarries.filter((q) => q.permit_status === 'active').length,
    missing: quarries.filter((q) => q.permit_status === 'none').length,
  }), [quarries]);

  const earthPagination = useClientPagination(data?.types_of_earth || []);
  const inspectionsPagination = useClientPagination(monitoringRecords);
  const permitsPagination = useClientPagination(quarries);

  if (loading && !data) return <div className="loader-container"><div className="spinner" /></div>;
  if (!data) return <div className="empty-state"><h3>Monitoring data is unavailable</h3></div>;

  const { stats, predictive_analysis: prediction } = data;

  return (
    <div className={`animate-fadeIn monitoring-report ${showInspection ? 'form-page-open' : ''}`}>
      <div className="page-header report-header">
        <div><h1>Monitoring & Reports</h1><p>Production, permits, environmental indicators, forecasts, and historical reporting.</p></div>
        <div className="flex gap-2 no-print">
          <button className="btn btn-secondary" onClick={() => setShowInspection(true)}><Plus size={17} /> Record inspection</button>
          <AdminPageActions />
        </div>
      </div>

      <div className="filters-bar no-print" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="tabs-container" style={{ margin: 0 }}>
          {periods.map(([value, label]) => <button key={value} className={`tab-btn ${period === value ? 'active' : ''}`} onClick={() => setPeriod(value)}>{label}</button>)}
        </div>
        {period === 'custom' && <div className="flex gap-2 items-center date-range-filter">
          <input className="form-input" type="date" value={dates.start} onChange={(event) => setDates((current) => ({ ...current, start: event.target.value }))} />
          <span className="text-muted filter-range-separator">to</span>
          <input className="form-input" type="date" value={dates.end} onChange={(event) => setDates((current) => ({ ...current, end: event.target.value }))} />
        </div>}
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-icon primary"><Mountain size={24} /></div><div className="stat-content"><h3>{stats.total_quarries}</h3><p>Registered quarry sites</p></div></div>
        <div className="stat-card"><div className="stat-icon success"><Truck size={24} /></div><div className="stat-content"><h3>{Number(stats.total_volume).toLocaleString()}</h3><p>Verified production (m³)</p></div></div>
        <div className="stat-card"><div className="stat-icon info"><TrendingUp size={24} /></div><div className="stat-content"><h3>{Number(prediction?.projected_next_month_volume || 0).toLocaleString()}</h3><p>Next-month forecast (m³)</p></div></div>
        <div className="stat-card"><div className="stat-icon accent"><AlertTriangle size={24} /></div><div className="stat-content"><h3>{permitSummary.expired + stats.illegal_quarries}</h3><p>Compliance actions</p></div></div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3>Production history</h3><span className="text-xs text-muted">Verified hauling volume</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={data.trend_hauling || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} />
                <Tooltip /><Area type="monotone" dataKey="total_volume" name="Volume (m³)" stroke="#0F766E" fill="#CCFBF1" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3><Cpu size={18} /> Naive Bayes productivity</h3><span className="badge badge-info">All-time history</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={270}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} /><Tooltip />
                <Line type="monotone" dataKey="actual" name="Actual (m³)" stroke="#0F766E" strokeWidth={2.5} connectNulls />
                <Line type="monotone" dataKey="forecast" name="Forecast (m³)" stroke="#D97706" strokeDasharray="6 4" strokeWidth={2.5} connectNulls />
                <Line type="monotone" dataKey="lower" name="Lower bound" stroke="#FBBF24" dot={false} connectNulls />
                <Line type="monotone" dataKey="upper" name="Upper bound" stroke="#FBBF24" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            {prediction?.status === 'ready' ? <div className="nb-result" style={{ borderColor: prediction.color }}>
              <span className="nb-result-grade" style={{ color: prediction.color }}>{prediction.classification}</span>
              <span><strong>{prediction.classification_label}</strong><small>{prediction.confidence}% posterior confidence · LOW {Math.round((prediction.probabilities?.low || 0) * 100)}% · STABLE {Math.round((prediction.probabilities?.stable || 0) * 100)}% · HIGH {Math.round((prediction.probabilities?.high || 0) * 100)}%</small></span>
            </div> : <div className="nb-result"><span><strong>Insufficient production data</strong><small>{prediction?.message}</small></span></div>}
            <p className="text-xs text-muted" style={{ marginTop: 8 }}>{prediction?.recommendation || prediction?.quota_depletion_forecast}</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h3><Shield size={18} /> Permit & site compliance</h3></div>
        <div className="card-body">
          <div className="compliance-grid">
            <div className="compliance-box success"><strong>{permitSummary.valid}</strong><span>Valid permits</span></div>
            <div className="compliance-box warning"><strong>{permitSummary.expiring}</strong><span>Expiring soon</span></div>
            <div className="compliance-box danger"><strong>{permitSummary.expired}</strong><span>Expired</span></div>
            <div className="compliance-box neutral"><strong>{permitSummary.missing}</strong><span>Not submitted</span></div>
          </div>
          <div className="status-strip">
            {data.stats.quarry_status_breakdown?.map((item) => <div key={item.status}><span style={{ background: item.color }} />{item.status}<strong>{item.count}</strong></div>)}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h3><FileText size={18} /> Types of earth & economic report</h3></div>
        <div className="table-container" style={{ border: 0 }}>
          <table className="table"><thead><tr><th>Material</th><th>Verified volume</th><th>Loads</th><th>Production share</th><th>Est. unit value</th><th>Est. total value</th></tr></thead>
            <tbody>{earthPagination.pageItems.map((item) => <tr key={item.material_type}>
              <td className="font-medium">{item.material_type}</td><td>{Number(item.total_volume).toLocaleString()} m³</td><td>{item.count}</td><td>{item.percentage}%</td>
              <td>₱{Number(item.estimated_unit_price).toLocaleString()}</td><td className="font-medium">₱{Number(item.estimated_total_value).toLocaleString()}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <Pagination meta={earthPagination.meta} onPageChange={earthPagination.setPage} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h3><ClipboardCheck size={18} /> Excavation & environmental inspections</h3><span className="text-xs text-muted">Latest auditable field readings</span></div>
        <div className="table-container" style={{ border: 0 }}><table className="table"><thead><tr><th>Date</th><th>Permittee Name</th><th>Depth</th><th>Setback</th><th>Water</th><th>Air</th><th>Noise</th><th>Flood risk</th><th>Compliance</th></tr></thead>
          <tbody>{inspectionsPagination.pageItems.map((record) => <tr key={record.id}>
            <td>{record.inspection_date}</td><td className="font-medium">{record.quarry?.name}</td><td>{record.excavation_depth_m ?? '—'} m</td><td>{record.river_setback_m ?? '—'} m</td>
            <td>{record.water_turbidity_ntu ?? '—'} NTU</td><td>{record.air_quality_pm25 ?? '—'} ug/m3</td><td>{record.noise_level_db ?? '—'} dB</td><td style={{ textTransform: 'capitalize' }}>{record.flood_risk || '—'}</td>
            <td><span className={`badge ${record.compliance_status === 'compliant' ? 'badge-success' : record.compliance_status === 'violation' ? 'badge-danger' : 'badge-warning'}`}>{record.compliance_status}</span></td>
          </tr>)}
          {!monitoringRecords.length && <tr><td colSpan={9} className="text-center text-muted" style={{ padding: 40 }}>No field inspections yet. Use “Record inspection” to add the first reading.</td></tr>}
          </tbody></table></div>
        <Pagination meta={inspectionsPagination.meta} onPageChange={inspectionsPagination.setPage} />
      </div>

      <div className="card">
        <div className="card-header"><h3>Permit monitoring register</h3><span className="text-xs text-muted">Automatic alerts are sent for restricted and expiring sites.</span></div>
        <div className="table-container" style={{ border: 0 }}><table className="table"><thead><tr><th>Permittee Name</th><th>Site status</th><th>Permit number</th><th>Expires</th><th>Permit status</th><th>Earth / production basis</th></tr></thead>
          <tbody>{permitsPagination.pageItems.map((q) => <tr key={q.id}><td className="font-medium">{q.name}</td><td><span className={`badge ${q.status === 'active' ? 'badge-success' : q.status === 'illegal' ? 'badge-danger' : 'badge-warning'}`}>{q.status}</span></td>
            <td>{q.permit_number || 'Not submitted'}</td><td>{q.permit_expires_at || '—'}</td><td><span className={`badge ${q.permit_status === 'active' ? 'badge-success' : q.permit_status === 'expired' ? 'badge-danger' : 'badge-warning'}`}>{q.permit_status}</span></td>
            <td>{q.hauling_count || 0} hauling records</td></tr>)}</tbody>
        </table></div>
        <Pagination meta={permitsPagination.meta} onPageChange={permitsPagination.setPage} />
      </div>

      {showInspection && <div className="full-page-form">
        <form className="full-page-form-card" style={{ maxWidth: 900 }} onSubmit={saveInspection}>
          <div className="modal-header"><div><h2>Record field inspection</h2><p className="text-sm text-muted">Excavation and environmental readings become part of the historical monitoring report.</p></div><button type="button" className="btn-ghost btn-icon" onClick={() => setShowInspection(false)}><X size={20} /></button></div>
          <div className="modal-body">
            <div className="inspection-form-grid">
              <div className="form-group"><label className="form-label" htmlFor="inspection-quarry">Permittee *</label><SearchableSelect id="inspection-quarry" required value={inspection.quarry_id} options={quarries.map((quarry) => ({ value: quarry.id, label: quarry.name }))} onChange={(quarryId) => setInspection((current) => ({ ...current, quarry_id: quarryId }))} placeholder="Select permittee" searchPlaceholder="Search permittees..." emptyMessage="No permittee found." /></div>
              <label className="form-group"><span className="form-label">Inspection date *</span><input className="form-input" type="date" required max={new Date().toISOString().slice(0, 10)} value={inspection.inspection_date} onChange={(event) => setInspection((current) => ({ ...current, inspection_date: event.target.value }))} /></label>
              <label className="form-group"><span className="form-label">Excavation depth (m)</span><input className="form-input" type="number" min="0" step="0.01" value={inspection.excavation_depth_m} onChange={(event) => setInspection((current) => ({ ...current, excavation_depth_m: event.target.value }))} /></label>
              <label className="form-group"><span className="form-label">River setback (m)</span><input className="form-input" type="number" min="0" step="0.01" value={inspection.river_setback_m} onChange={(event) => setInspection((current) => ({ ...current, river_setback_m: event.target.value }))} /></label>
              <label className="form-group"><span className="form-label">Air quality PM2.5 (ug/m3)</span><input className="form-input" type="number" min="0" step="0.01" value={inspection.air_quality_pm25} onChange={(event) => setInspection((current) => ({ ...current, air_quality_pm25: event.target.value }))} /></label>
              <label className="form-group"><span className="form-label">Water turbidity (NTU)</span><input className="form-input" type="number" min="0" step="0.01" value={inspection.water_turbidity_ntu} onChange={(event) => setInspection((current) => ({ ...current, water_turbidity_ntu: event.target.value }))} /></label>
              <label className="form-group"><span className="form-label">Noise level (dB)</span><input className="form-input" type="number" min="0" max="250" step="0.01" value={inspection.noise_level_db} onChange={(event) => setInspection((current) => ({ ...current, noise_level_db: event.target.value }))} /></label>
              <label className="form-group"><span className="form-label">Rehabilitated area (ha)</span><input className="form-input" type="number" min="0" step="0.01" value={inspection.rehabilitated_area_ha} onChange={(event) => setInspection((current) => ({ ...current, rehabilitated_area_ha: event.target.value }))} /></label>
              <div className="form-group"><label className="form-label" htmlFor="inspection-flood-risk">Flood risk</label><SearchableSelect id="inspection-flood-risk" value={inspection.flood_risk} options={[{ value: '', label: 'Not assessed' }, { value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }]} onChange={(floodRisk) => setInspection((current) => ({ ...current, flood_risk: floodRisk }))} /></div>
              <div className="form-group"><label className="form-label" htmlFor="inspection-compliance">Compliance *</label><SearchableSelect id="inspection-compliance" required value={inspection.compliance_status} options={[{ value: 'compliant', label: 'Compliant' }, { value: 'watch', label: 'Watch' }, { value: 'violation', label: 'Violation' }]} onChange={(complianceStatus) => setInspection((current) => ({ ...current, compliance_status: complianceStatus }))} /></div>
            </div>
            <label className="form-group"><span className="form-label">Inspection notes</span><textarea className="form-textarea" rows="3" maxLength="2000" value={inspection.notes} onChange={(event) => setInspection((current) => ({ ...current, notes: event.target.value }))} placeholder="Document observed conditions, corrective actions, and evidence references." /></label>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowInspection(false)}>Cancel</button><button className="btn btn-primary" disabled={savingInspection}>{savingInspection ? 'Saving…' : 'Save inspection'}</button></div>
        </form>
      </div>}
    </div>
  );
}
