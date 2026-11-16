import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  MapPin, LayoutDashboard, Users, Mountain, FileText,
  Truck, Shield, ClipboardCheck, History, Plus, LogOut, Menu, X, ChevronLeft, ChevronRight, Bell, ClipboardList, Building2,
  BarChart3, Route, DatabaseBackup, MoreHorizontal, Wifi, WifiOff
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import { PwaInstallButton } from '../PwaInstallPrompt';
import { getAnalytics } from '../../api/analytics';

const buildAdminLinks = (badges = {}) => [
  { section: 'Overview', links: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'Management', links: [
    { to: '/admin/quarries', label: 'Quarries', icon: Mountain, badge: badges.quarries },
    { to: '/admin/users', label: 'Users', icon: Users, badge: badges.users },
    { to: '/admin/operator-applications', label: 'Operator Applications', icon: Building2 },
    { to: '/admin/checkpoints', label: 'Checkpoints', icon: Shield, badge: badges.checkpoints },
  ]},
  { section: 'Records', links: [
    { to: '/admin/hauling-records', label: 'Hauling Records', icon: Truck },
    { to: '/admin/monitoring', label: 'Monitoring & Reports', icon: BarChart3 },
    { to: '/admin/operations-map', label: 'GIS Operations Map', icon: Route },
  ]},
  { section: 'Security', links: [
    { to: '/admin/audit-trail', label: 'Audit Trail', icon: ClipboardList },
    { to: '/admin/system-maintenance', label: 'Backup & Recovery', icon: DatabaseBackup },
  ]},
];

const operatorLinks = [
  { section: 'Overview', links: [
    { to: '/operator/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'Staff', links: [
    { to: '/operator/staff', label: 'My Staff', icon: Users },
  ]},
  { section: 'Hauling', links: [
    { to: '/operator/new-hauling', label: 'New Record', icon: Plus },
    { to: '/operator/history', label: 'My History', icon: History },
  ]},
];

const staffLinks = [
  { section: 'Overview', links: [
    { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'Hauling', links: [
    { to: '/staff/new-hauling', label: 'New Record', icon: Plus },
    { to: '/staff/history', label: 'My History', icon: History },
  ]},
];

const checkpointLinks = (badges = {}) => [
  { section: 'Overview', links: [
    { to: '/checkpoint/dashboard', label: 'Verification Queue', icon: ClipboardCheck, badge: badges.verifications },
  ]},
  { section: 'Records', links: [
    { to: '/checkpoint/history', label: 'My History', icon: History },
  ]},
];

const mobileNavigation = {
  admin: [
    { to: '/admin/dashboard', label: 'Home', icon: LayoutDashboard },
    { to: '/admin/operations-map', label: 'Map', icon: Route },
    { to: '/admin/monitoring', label: 'Reports', icon: BarChart3 },
  ],
  quarry_operator: [
    { to: '/operator/dashboard', label: 'Home', icon: LayoutDashboard },
    { to: '/operator/new-hauling', label: 'New Haul', icon: Plus },
    { to: '/operator/history', label: 'History', icon: History },
  ],
  quarry_staff: [
    { to: '/staff/dashboard', label: 'Home', icon: LayoutDashboard },
    { to: '/staff/new-hauling', label: 'New Haul', icon: Plus },
    { to: '/staff/history', label: 'History', icon: History },
  ],
  checkpoint_officer: [
    { to: '/checkpoint/dashboard', label: 'Verify', icon: ClipboardCheck },
    { to: '/checkpoint/history', label: 'History', icon: History },
  ],
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const pageContentRef = useRef(null);
  const confirm = useConfirm();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    const ok = await confirm({ title: 'Logout', message: 'Are you sure you want to log out?', confirmText: 'Logout', type: 'warning' });
    if (ok) logout();
  };

  const [badges, setBadges] = useState({});

  // Fetch badge counts dynamically when path changes to keep them fresh
  useEffect(() => {
    import('../../api/notifications').then(({ getUnreadCount }) => {
      getUnreadCount().then(res => {
        setBadges(prev => ({ ...prev, unreadNotifications: res.data.count }));
      }).catch(() => {});
    });

    if (user?.role === 'admin') {
      getAnalytics().then(res => {
        const s = res.data.stats;
        setBadges(prev => ({
          ...prev,
          quarries: s.active_quarries ?? 0,
          users: s.active_users ?? 0,
          checkpoints: s.total_checkpoints ?? 0,
        }));
      }).catch(() => {});
    } else if (user?.role === 'checkpoint_officer') {
      import('../../api/checkpoints').then(({ getPendingRecords }) => {
        getPendingRecords({ per_page: 1 }).then(res => {
          setBadges(prev => ({
            ...prev,
            verifications: res.data.meta?.total || res.data.hauling_records?.length || 0,
          }));
        }).catch(() => {});
      });
    }
  }, [user?.role, pathname]);

  const roleNavLinks = user?.role === 'admin' ? buildAdminLinks(badges)
    : user?.role === 'quarry_operator' ? operatorLinks
    : user?.role === 'quarry_staff' ? staffLinks
    : checkpointLinks(badges);

  // Less frequently used destinations remain available in the mobile drawer,
  // keeping the bottom bar focused on each role's main daily tasks.
  const navLinks = [
    ...roleNavLinks,
    { section: 'General', links: [
      { to: '/', label: 'Public Map', icon: MapPin },
    ]},
  ];

  const mobileLinks = mobileNavigation[user?.role] || [];
  const mobilePrimaryActive = mobileLinks.some((link) => pathname === link.to);

  const roleLabel = {
    admin: 'Administrator',
    quarry_operator: 'Quarry Operator',
    quarry_staff: 'Quarry Staff',
    checkpoint_officer: 'Checkpoint Officer',
  };

  const currentPageLabel = pathname === '/notifications'
    ? 'Notifications'
    : navLinks
      .flatMap((group) => group.links)
      .sort((a, b) => b.to.length - a.to.length)
      .find((link) => pathname === link.to || pathname.startsWith(`${link.to}/`))?.label || 'Geosand';

  // Add table header labels to cells so every existing desktop table can
  // become a readable card list on narrow screens without duplicating pages.
  useEffect(() => {
    const root = pageContentRef.current;
    if (!root) return undefined;

    const enhanceTables = () => {
      root.querySelectorAll('table.table').forEach((table) => {
        const headers = [...table.querySelectorAll('thead th')].map((header) => header.textContent.trim());
        table.querySelectorAll('tbody tr').forEach((row) => {
          [...row.children].forEach((cell, index) => {
            if (cell.tagName !== 'TD') return;
            cell.dataset.label = cell.colSpan > 1 ? '' : (headers[index] || 'Details');
          });
        });
      });
    };

    enhanceTables();
    const observer = new MutationObserver(enhanceTables);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div className={`app-layout role-${user?.role || 'user'} ${collapsed && !isMobile ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${isMobile ? (mobileOpen ? 'mobile-open' : 'mobile-closed') : (collapsed ? 'collapsed' : '')}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <MapPin size={22} color="white" />
          </div>
          {(!collapsed || isMobile) && (
            <div>
              <h1>Geosand</h1>
              <span>{roleLabel[user?.role] || 'User'}</span>
            </div>
          )}
          {/* Close button on mobile */}
          {isMobile && (
            <button className="btn-ghost btn-icon sidebar-close-btn" onClick={() => setMobileOpen(false)}>
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((group) => (
            <div key={group.section} className="sidebar-section">
              {(!collapsed || isMobile) && (
                <div className="sidebar-section-title">{group.section}</div>
              )}
              {group.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`sidebar-link ${pathname === link.to ? 'active' : ''}`}
                  onClick={() => isMobile && setMobileOpen(false)}
                  title={collapsed && !isMobile ? link.label : undefined}
                >
                  <link.icon className="link-icon" size={20} />
                  {(!collapsed || isMobile) && (
                    <span style={{ flex: 1 }}>{link.label}</span>
                  )}
                  {(!collapsed || isMobile) && link.badge > 0 && (
                    <span style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: '1px 6px',
                      lineHeight: 1.6,
                      minWidth: 18,
                      textAlign: 'center',
                      marginLeft: 'auto',
                    }}>
                      {link.badge > 99 ? '99+' : link.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <PwaInstallButton variant="sidebar" />

        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" />
            ) : (
              user?.name?.charAt(0)?.toUpperCase()
            )}
          </div>
          {(!collapsed || isMobile) && (
            <div className="sidebar-user-info">
              <p>{user?.name}</p>
              <span>{user?.role?.replace('_', ' ')}</span>
            </div>
          )}
          <button className="btn-ghost btn-icon" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>

        {/* Desktop collapse toggle */}
        {!isMobile && (
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div className="mobile-header-start">
            <button className="btn-ghost btn-icon sidebar-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <div className="mobile-header-copy">
              <strong>{currentPageLabel}</strong>
            </div>
          </div>
          <div className="main-header-actions flex gap-2 items-center">
            <span className={`connection-status ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Connected' : 'Offline'}>
              {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </span>
            <Link
              to="/notifications"
              className="btn-ghost btn-icon"
              title="Notifications"
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <Bell size={20} className="text-gray-600" />
                {(() => {
                  const count = (badges.unreadNotifications || 0);
                  return count > 0 ? (
                    <span style={{
                      position: 'absolute',
                      top: -6, right: -8,
                      minWidth: 18, height: 18,
                      borderRadius: 999,
                      background: 'var(--danger)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      border: '2px solid var(--surface)',
                      lineHeight: 1,
                    }}>
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null;
                })()}
              </div>
            </Link>
            <Link to="/" className="btn btn-ghost btn-sm view-map-action">
              <MapPin size={16} /> <span>View Map</span>
            </Link>
          </div>
        </header>
        <div className="page-content" ref={pageContentRef}>
          <Outlet />
        </div>
      </main>

      <nav className="mobile-bottom-nav no-print" aria-label="Primary mobile navigation">
        {mobileLinks.map((link) => {
          const active = pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`mobile-bottom-link ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <link.icon size={21} />
              <span>{link.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`mobile-bottom-link ${!mobilePrimaryActive ? 'active' : ''}`}
          onClick={() => setMobileOpen(true)}
          aria-label="Open all navigation"
        >
          <MoreHorizontal size={21} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
