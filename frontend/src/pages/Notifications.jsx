import { useEffect, useState } from 'react';
import { getNotifications, markAsRead, markAllAsRead } from '../api/notifications';
import { Bell, CheckCircle2, Circle, Clock, Info, ShieldAlert, FileText, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import { useNavigate } from 'react-router-dom';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const navigate = useNavigate();

  const fetchNotifications = (p = page) => {
    setLoading(true);
    getNotifications({ page: p, per_page: 10 })
      .then((res) => {
        setNotifications(res.data.notifications.data);
        setMeta({
          current_page: res.data.notifications.current_page,
          last_page: res.data.notifications.last_page,
          total: res.data.notifications.total,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (err) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, read_at: new Date().toISOString() })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read_at) {
      handleMarkAsRead(notification.id);
    }
    if (notification.data?.url) {
      navigate(notification.data.url);
    }
  };

  const getIcon = (type) => {
    if (type?.includes('Fraud') || type?.includes('Alert')) return <ShieldAlert size={20} className="text-danger" />;
    if (type?.includes('Hauling')) return <Truck size={20} className="text-warning" />;
    return <Info size={20} className="text-info" />;
  };

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="flex items-center gap-2">
            <Bell size={24} style={{ color: 'var(--primary)' }} /> Notifications
          </h1>
          <p>View your recent activity and alerts</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleMarkAllAsRead} disabled={notifications.every(n => n.read_at)}>
          <CheckCircle2 size={16} /> Mark all as read
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loader-container" style={{ padding: 40 }}><div className="spinner" /></div>
        ) : notifications.length === 0 ? (
          <div className="empty-state" style={{ padding: 60 }}>
            <Bell size={48} style={{ color: 'var(--gray-300)', marginBottom: 16 }} />
            <h3>You're all caught up!</h3>
            <p>No notifications to display right now.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  gap: 16,
                  cursor: n.data?.url ? 'pointer' : 'default',
                  background: n.read_at ? 'var(--surface)' : 'rgba(20, 184, 166, 0.05)',
                  transition: 'background 0.2s',
                }}
                className="hover:bg-gray-50"
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: n.read_at ? 'var(--gray-100)' : 'var(--primary-100)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {getIcon(n.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: n.read_at ? 500 : 600, color: 'var(--text-primary)' }}>
                      {n.data?.title || 'Notification'}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: n.read_at ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                    {n.data?.message || JSON.stringify(n.data)}
                  </p>
                </div>
                {!n.read_at && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Circle size={10} fill="var(--primary)" color="var(--primary)" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
