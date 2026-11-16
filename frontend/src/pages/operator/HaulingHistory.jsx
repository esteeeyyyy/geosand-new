import { useEffect, useState } from 'react';
import { getMyHaulingRecords } from '../../api/hauling';
import { Search } from 'lucide-react';
import Pagination from '../../components/Pagination';

export default function HaulingHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);

  const fetchData = (p = page) => {
    setLoading(true);
    getMyHaulingRecords({ status: statusFilter || undefined, page: p, per_page: 10 })
      .then((res) => { setRecords(res.data.hauling_records); setMeta(res.data.meta); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(1); setPage(1); }, [statusFilter]);
  useEffect(() => { fetchData(); }, [page]);

  const statusBadge = (s) => (
    <span className={`badge ${s === 'verified' ? 'badge-success' : s === 'pending' ? 'badge-warning' : 'badge-danger'}`}>{s}</span>
  );

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div><h1>Hauling History</h1><p>All your hauling records</p></div>
      </div>

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

      <div className="table-container">
        {loading ? (
          <div className="loader-container"><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Tracking Code</th><th>Permittee Name</th><th>Truck</th><th>Volume</th><th>Material</th><th>Destination</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }} className="font-medium">{r.tracking_code}</td>
                  <td>{r.quarry?.name}</td>
                  <td>{r.truck_plate_number}</td>
                  <td>{r.volume_cubic_meters} m³</td>
                  <td>{r.material_type}</td>
                  <td className="text-sm">{r.destination}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td className="text-sm text-muted">{new Date(r.hauled_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted" style={{ padding: 40 }}>No records found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
