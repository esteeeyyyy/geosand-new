import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Truck, Mountain, Plus, AlertTriangle, Calendar, Clock } from 'lucide-react';

export default function StaffDashboard() {
  const { user } = useAuth();
  const quarry = user?.quarry;

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Staff Dashboard</h1>
          <p>Submit hauling records for your assigned permittee</p>
        </div>
      </div>

      {/* Permit Warning Banner */}
      {quarry?.permit_status === 'expired' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderRadius: 'var(--radius-md)', background: '#FEE2E2', border: '1px solid #FCA5A5',
          color: '#991B1B', marginBottom: 20, fontSize: '0.875rem', fontWeight: 500,
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Permit Expired:</strong> Your quarry permit ({quarry.permit_number || 'N/A'}) expired on <strong>{quarry.permit_expires_at}</strong>.
          </div>
        </div>
      )}

      {quarry?.permit_status === 'expiring_soon' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderRadius: 'var(--radius-md)', background: '#FEF3C7', border: '1px solid #FDE68A',
          color: '#92400E', marginBottom: 20, fontSize: '0.875rem', fontWeight: 500,
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Permit Expiring Soon:</strong> Your quarry permit ({quarry.permit_number || 'N/A'}) will expire in <strong>{quarry.days_until_permit_expiration} days</strong> on <strong>{quarry.permit_expires_at}</strong>.
          </div>
        </div>
      )}

      {quarry?.permit_status === 'not_started' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderRadius: 'var(--radius-md)', background: '#FEF3C7', border: '1px solid #FDE68A',
          color: '#92400E', marginBottom: 20, fontSize: '0.875rem', fontWeight: 500,
        }}>
          <Clock size={20} style={{ flexShrink: 0 }} />
          <div><strong>Permit Not Yet Effective:</strong> Your permit starts on <strong>{quarry.permit_issued_at}</strong>.</div>
        </div>
      )}

      {/* Quarry Info */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="stat-icon primary"><Mountain size={24} /></div>
              <div>
                <p className="text-xs text-muted">Your Assigned Permittee</p>
                <h3 style={{ fontSize: '1.25rem' }}>{quarry?.name || 'Not Assigned'}</h3>
                {quarry?.address && <p className="text-sm text-muted">{quarry.address}</p>}
              </div>
            </div>
            {quarry?.permit_expires_at && (
              <div style={{ textAlign: 'right' }}>
                <p className="text-xs text-muted">Permit Expiry</p>
                <span className={`badge ${quarry.permit_status === 'expired' ? 'badge-danger' : quarry.permit_status === 'expiring_soon' ? 'badge-warning' : 'badge-success'}`}>
                  {quarry.permit_expires_at} ({quarry.permit_status})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid-2" style={{ gap: 16 }}>
        <Link to="/staff/new-hauling" className="card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Plus size={28} style={{ color: 'var(--primary)' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', marginBottom: 4 }}>New Hauling Record</h3>
            <p className="text-sm text-muted">Submit a new hauling operation record</p>
          </div>
        </Link>
        <Link to="/staff/history" className="card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--info-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Truck size={28} style={{ color: 'var(--info)' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', marginBottom: 4 }}>My History</h3>
            <p className="text-sm text-muted">View your submitted hauling records</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
