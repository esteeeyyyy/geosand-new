import { useEffect, useState } from 'react';
import { getStaffHaulingRecords } from '../../api/hauling';
import { Truck, Clock } from 'lucide-react';
import Pagination from '../../components/Pagination';

export default function StaffHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);

  const fetchData = (p = page) => {
    setLoading(true);
    getStaffHaulingRecords({ page: p, per_page: 10 })
      .then(res => { setRecords(res.data.hauling_records); setMeta(res.data.meta); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]);

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div><h1>My Hauling History</h1><p>Records you have submitted</p></div>
      </div>
      <div className="table-container">
        {loading ? <div className="loader-container"><div className="spinner" /></div> : (
          <table className="table">
            <thead><tr><th>Tracking Code</th><th>Material</th><th>Volume</th><th>Truck</th><th>Destination</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>{r.tracking_code}</td>
                  <td>{r.material_type}</td>
                  <td className="font-medium">{r.volume_cubic_meters} m³</td>
                  <td>{r.truck_plate_number}</td>
                  <td className="text-sm">{r.destination}</td>
                  <td><span className={`badge ${r.status === 'verified' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{r.status}</span></td>
                  <td className="text-sm text-muted">{new Date(r.hauled_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>No records yet</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
