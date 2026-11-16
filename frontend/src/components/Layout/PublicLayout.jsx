import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { MapPin, LogIn, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function PublicLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'admin': return '/admin/dashboard';
      case 'quarry_operator': return '/operator/dashboard';
      case 'quarry_staff': return '/staff/dashboard';
      case 'checkpoint_officer': return '/checkpoint/dashboard';
      default: return '/';
    }
  };

  return (
    <div className="public-layout">
      <header className="public-header">
        <Link to="/" className="public-header-brand">
          <div className="brand-icon">
            <MapPin size={20} />
          </div>
          <h1>Geosand</h1>
        </Link>
        <nav className="public-nav">
          <Link to="/" className={pathname === '/' ? 'active' : ''}>Map</Link>
          
          {!user && (
            <Link
              to="/be-an-operator"
              className="btn btn-outline btn-sm operator-application-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}
              title="Be an Operator"
              aria-label="Be an Operator"
            >
              <Building2 size={16} /> <span>Be an Operator</span>
            </Link>
          )}

          {user ? (
            <Link to={getDashboardPath()} className="btn btn-primary btn-sm">Dashboard</Link>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm sign-in-link">
              <LogIn size={16} /> <span>Sign In</span>
            </Link>
          )}
        </nav>
      </header>

      <Outlet context={{ openOperatorModal: user ? null : () => navigate('/be-an-operator') }} />
    </div>
  );
}
