import { useEffect, useState } from 'react';
import { getOperatorAnalytics } from '../../api/hauling';
import { Truck, Mountain, Package, Clock, CheckCircle, XCircle, Users, AlertTriangle } from 'lucide-react';
import Pagination from '../../components/Pagination';

export default function OperatorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentPage, setRecentPage] = useState(1);

  useEffect(() => {
    getOperatorAnalytics({ recent_page: recentPage })
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [recentPage]);

  if (loading) return <div className="loader-container"><div className="spinner" /></div>;
  if (!data) return <div className="card"><div className="card-body text-center text-muted">No quarry assigned.</div></div>;

  const { stats, monthly_hauling, material_breakdown, recent_hauling, recent_hauling_meta } = data;

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>{stats.quarry_name}</h1>
          <p>Quarry operator analytics dashboard</p>
        </div>
      </div>

      {/* Permit Warning Banner */}
      {stats.permit_status === 'expired' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderRadius: 'var(--radius-md)', background: '#FEE2E2', border: '1px solid #FCA5A5',
          color: '#991B1B', marginBottom: 20, fontSize: '0.875rem', fontWeight: 500,
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Permit Expired:</strong> The quarry permit ({stats.permit_number || 'N/A'}) expired on <strong>{stats.permit_expires_at}</strong>. Please renew immediately.
          </div>
        </div>
      )}

      {stats.permit_status === 'expiring_soon' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderRadius: 'var(--radius-md)', background: '#FEF3C7', border: '1px solid #FDE68A',
          color: '#92400E', marginBottom: 20, fontSize: '0.875rem', fontWeight: 500,
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Permit Expiring Soon:</strong> The quarry permit ({stats.permit_number || 'N/A'}) will expire in <strong>{stats.days_until_permit_expiration} days</strong> on <strong>{stats.permit_expires_at}</strong>.
          </div>
        </div>
      )}

      {stats.permit_status === 'not_started' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderRadius: 'var(--radius-md)', background: '#FEF3C7', border: '1px solid #FDE68A',
          color: '#92400E', marginBottom: 20, fontSize: '0.875rem', fontWeight: 500,
        }}>
          <Clock size={20} style={{ flexShrink: 0 }} />
          <div><strong>Permit Not Yet Effective:</strong> This permit starts on <strong>{stats.permit_issued_at}</strong>.</div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon primary"><Truck size={24} /></div>
          <div className="stat-content"><h3>{stats.total_hauling_records}</h3><p>Total Records</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><Package size={24} /></div>
          <div className="stat-content">
            <h3>{stats.total_volume} m³</h3>
            <p>Permit-term volume{stats.permit_issued_at ? ` (${stats.permit_issued_at} to ${stats.permit_expires_at})` : ''}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon accent"><Clock size={24} /></div>
          <div className="stat-content"><h3>{stats.pending_hauling}</h3><p>Pending</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon info"><Users size={24} /></div>
          <div className="stat-content"><h3>{stats.staff_count}</h3><p>Staff Members</p></div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        {/* Status Overview */}
        <div className="card">
          <div className="card-header"><h3>Status Overview</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><CheckCircle size={16} style={{ color: 'var(--success)' }} /> Verified</div>
                <strong>{stats.verified_hauling}</strong>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Clock size={16} style={{ color: 'var(--warning)' }} /> Pending</div>
                <strong>{stats.pending_hauling}</strong>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><XCircle size={16} style={{ color: 'var(--danger)' }} /> Rejected</div>
                <strong>{stats.rejected_hauling}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Records */}
      <div className="card">
        <div className="card-header"><h3>Recent Hauling Records</h3></div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead><tr><th>Code</th><th>Submitted By</th><th>Material</th><th>Volume</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {recent_hauling?.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>{r.tracking_code}</td>
                  <td className="font-medium text-sm">{r.operator}</td>
                  <td className="text-sm">{r.material}</td>
                  <td className="font-medium">{r.volume.toFixed(1)} m³</td>
                  <td>
                    <span className={`badge ${r.status === 'verified' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{r.status}</span>
                  </td>
                  <td className="text-sm text-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!recent_hauling || recent_hauling.length === 0) && <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 30 }}>No records yet</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination meta={recent_hauling_meta} onPageChange={setRecentPage} />
      </div>
    </div>
  );
}
