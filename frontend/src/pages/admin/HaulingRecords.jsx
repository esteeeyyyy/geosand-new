import { useEffect, useState } from 'react';
import { getAllHaulingRecords } from '../../api/hauling';
import { getQuarries } from '../../api/quarries';
import { PackageCheck, Search, Truck } from 'lucide-react';
import Pagination from '../../components/Pagination';
import AdminPageActions from '../../components/AdminPageActions';
import SearchableSelect from '../../components/SearchableSelect';

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

export default function AdminHauling() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [quarryFilter, setQuarryFilter] = useState('');
  const [quarries, setQuarries] = useState([]);
  const [period, setPeriod] = useState('all');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState({ total_volume_cubic_meters: 0, total_records: 0 });

  const fetchData = (p = page) => {
    if (period === 'custom' && (!customDates.start || !customDates.end)) return;

    setLoading(true);
    const params = {
      search,
      status: statusFilter || undefined,
      quarry_id: quarryFilter || undefined,
      period,
      page: p,
      per_page: 10,
    };
    if (period === 'custom') {
      params.date_from = customDates.start;
      params.date_to = customDates.end;
    }

    getAllHaulingRecords(params)
      .then(r => {
        setRecords(r.data.hauling_records);
        setMeta(r.data.meta);
        setSummary(r.data.summary || { total_volume_cubic_meters: 0, total_records: 0 });
      })
      .catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => {
    getQuarries({ per_page: 100 })
      .then((response) => setQuarries(response.data.quarries || []))
      .catch(console.error);
  }, []);
  useEffect(() => { fetchData(1); setPage(1); }, [statusFilter, quarryFilter, search, period, customDates.start, customDates.end]);
  useEffect(() => { fetchData(); }, [page]);

  const statusBadge = (s) => <span className={`badge ${s==='verified'?'badge-success':s==='pending'?'badge-warning':'badge-danger'}`}>{s}</span>;
  const menroOfficerName = (record) => {
    const latestVerification = (record.verifications || []).reduce((latest, verification) => {
      if (!latest) return verification;
      return new Date(verification.verified_at) > new Date(latest.verified_at) ? verification : latest;
    }, null);

    return latestVerification?.officer?.name || '—';
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div><h1>Hauling Records</h1><p>View each permittee's daily, weekly, and monthly hauling activity</p></div>
        <AdminPageActions />
      </div>
      <div className="filters-bar no-print" style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <form className="search-input" onSubmit={e=>{e.preventDefault();fetchData(1);setPage(1);}}>
          <Search className="search-icon"/><input placeholder="Search tracking code..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </form>
        <SearchableSelect
          id="hauling-quarry-filter"
          value={quarryFilter}
          onChange={setQuarryFilter}
          options={[
            { value: '', label: 'All Permittees' },
            ...quarries.map((quarry) => ({ value: quarry.id, label: quarry.name })),
          ]}
          ariaLabel="Filter hauling records by permittee"
          containerStyle={{ width: 260 }}
          placeholder="All Permittees"
          searchPlaceholder="Search permittees..."
        />
      </div>
      <div className="tabs-container no-print" role="tablist" aria-label="Hauling records period">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={period === option.value}
            className={`tab-btn ${period === option.value ? 'active' : ''}`}
            onClick={() => { setPeriod(option.value); setPage(1); }}
          >
            {option.label}
          </button>
        ))}
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
      <div className="tabs-container">
        {[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'verified', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }].map(tab => (
          <button
            key={tab.value}
            className={`tab-btn ${statusFilter === tab.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-icon primary"><PackageCheck size={22} /></div>
          <div className="stat-content">
            <h3>{Number(summary.total_volume_cubic_meters || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} m³</h3>
            <p>Total cubic meters for the selected filters</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon info"><Truck size={22} /></div>
          <div className="stat-content">
            <h3>{Number(summary.total_records || 0).toLocaleString()}</h3>
            <p>Matching hauling records</p>
          </div>
        </div>
      </div>
      <div className="table-container">
        {loading ? <div className="loader-container"><div className="spinner"/></div> : (
        <table className="table">
          <thead><tr><th>Tracking Code</th><th>Permittee Name</th><th>MENRO Officer</th><th>Truck</th><th>Volume</th><th>Material</th><th>Destination</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id}>
                <td style={{fontFamily:'monospace',fontSize:'0.8125rem'}} className="font-medium">{r.tracking_code}</td>
                <td>{r.quarry?.name}</td>
                <td>{menroOfficerName(r)}</td>
                <td>{r.truck_plate_number}</td>
                <td>{r.volume_cubic_meters} m³</td>
                <td>{r.material_type}</td>
                <td className="text-sm">{r.destination}</td>
                <td>{statusBadge(r.status)}</td>
                <td className="text-sm text-muted">{new Date(r.hauled_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
              </tr>
            ))}
            {records.length===0 && <tr><td colSpan={9} className="text-center text-muted" style={{padding:40}}>No records</td></tr>}
          </tbody>
        </table>)}
      </div>
      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
