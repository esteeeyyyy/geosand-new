import { useEffect, useRef, useState } from 'react';
import { getAnalytics } from '../../api/analytics';
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Mountain, Truck, Clock, Shield, ChevronDown, Check } from 'lucide-react';
import AdminPageActions from '../../components/AdminPageActions';
import Pagination from '../../components/Pagination';

const COLORS = ['#0F766E', '#14B8A6', '#D97706', '#2563EB', '#8B5CF6', '#EC4899'];

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', fontSize: 13,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
    }}>
      <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{Number(p.value).toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 12px', fontSize: 13,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
    }}>
      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill, margin: 0 }}>
        {Number(payload[0].value).toLocaleString()} m³
      </p>
    </div>
  );
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [recentPage, setRecentPage] = useState(1);
  const periodMenuRef = useRef(null);

  useEffect(() => {
    setRecentPage(1);
  }, [period, customDates.start, customDates.end]);

  useEffect(() => {
    if (!periodMenuOpen) return undefined;

    const closeOnOutsidePress = (event) => {
      if (!periodMenuRef.current?.contains(event.target)) setPeriodMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPeriodMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [periodMenuOpen]);

  useEffect(() => {
    if (period === 'custom' && (!customDates.start || !customDates.end)) {
      return; // Wait for both dates
    }

    setLoading(true);
    const params = { period, recent_page: recentPage };
    if (period === 'custom') {
      params.start_date = customDates.start;
      params.end_date = customDates.end;
    }

    getAnalytics(params)
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period, customDates.start, customDates.end, recentPage]);

  if (loading && !data) return <div className="loader-container"><div className="spinner" /></div>;
  if (!data) return <div className="empty-state"><h3>Failed to load analytics</h3></div>;

  const { stats, trend_hauling, trend_by_quarry, volume_by_quarry, material_breakdown, recent_hauling, recent_hauling_meta } = data;

  const periodLabel = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    all: 'All Time',
    custom: customDates.start && customDates.end ? `${customDates.start} to ${customDates.end}` : 'Custom Range'
  }[period];

  const trendData = trend_hauling.map(m => ({
    ...m,
    label: m.label,
  }));

  // Pivot trend_by_quarry rows into { label, QuarryA: vol, QuarryB: vol, ... }
  const quarryNames = trend_by_quarry?.quarries ?? [];
  const quarryLineData = (() => {
    const rows = trend_by_quarry?.rows ?? [];
    const labelMap = {};
    rows.forEach(({ label, quarry_name, total_volume }) => {
      if (!labelMap[label]) labelMap[label] = { label };
      labelMap[label][quarry_name] = Number(total_volume);
    });
    return Object.values(labelMap).sort((a, b) => a.label.localeCompare(b.label));
  })();

  const pieData = material_breakdown.map((m, i) => ({
    name: m.material_type || 'Unknown',
    value: Number(m.total_volume),
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="animate-fadeIn admin-dashboard-page">
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Overview of quarry operations in Bongabong, Oriental Mindoro</p>
        </div>
        <div className="flex gap-2 items-center no-print dashboard-toolbar" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="tabs-container dashboard-period-tabs" style={{ margin: 0 }}>
            {PERIOD_OPTIONS.map(tab => (
              <button
                key={tab.value}
                className={`tab-btn ${period === tab.value ? 'active' : ''}`}
                onClick={() => setPeriod(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="dashboard-mobile-period" ref={periodMenuRef}>
            <span id="mobile-period-label">Time period</span>
            <button
              type="button"
              className="dashboard-period-trigger"
              onClick={() => setPeriodMenuOpen((open) => !open)}
              aria-labelledby="mobile-period-label"
              aria-haspopup="listbox"
              aria-expanded={periodMenuOpen}
            >
              <span>{PERIOD_OPTIONS.find((option) => option.value === period)?.label}</span>
              <ChevronDown size={18} className={periodMenuOpen ? 'open' : ''} />
            </button>
            {periodMenuOpen && (
              <div className="dashboard-period-menu" role="listbox" aria-label="Time period">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={period === option.value}
                    className={period === option.value ? 'active' : ''}
                    onClick={() => {
                      setPeriod(option.value);
                      setPeriodMenuOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {period === option.value && <Check size={17} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <AdminPageActions />
        </div>
      </div>
      
      {period === 'custom' && (
        <div className="filters-bar date-range-filter" style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', background: 'var(--surface)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span className="text-sm font-medium filter-label">Custom Range:</span>
          <input 
            type="date" 
            className="form-input" 
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }} 
            value={customDates.start}
            onChange={(e) => setCustomDates(d => ({ ...d, start: e.target.value }))}
          />
          <span className="text-muted filter-range-separator">to</span>
          <input 
            type="date" 
            className="form-input" 
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }} 
            value={customDates.end}
            onChange={(e) => setCustomDates(d => ({ ...d, end: e.target.value }))}
          />
        </div>
      )}

      {loading && <div style={{ position: 'absolute', top: 100, right: 20 }}><div className="spinner" style={{ width: 24, height: 24 }} /></div>}

      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon primary"><Mountain size={24} /></div>
          <div className="stat-content"><h3>{stats.active_quarries}</h3><p>Active Quarries</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><Truck size={24} /></div>
          <div className="stat-content"><h3>{stats.total_volume.toLocaleString()}</h3><p>Verified Volume (m³)</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon accent"><Clock size={24} /></div>
          <div className="stat-content"><h3>{stats.pending_hauling}</h3><p>Pending Verifications</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon info"><Shield size={24} /></div>
          <div className="stat-content"><h3>{stats.total_checkpoints}</h3><p>Active Checkpoints</p></div>
        </div>
      </div>

      {/* Monthly Volume — Area Trend Chart */}
      <div style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Hauling Trend</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{periodLabel} · verified volume</span>
          </div>
          <div className="card-body">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F766E" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" fontSize={12} tick={{ fill: 'var(--text-tertiary)' }} />
                  <YAxis fontSize={12} tick={{ fill: 'var(--text-tertiary)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total_volume"
                    name="Volume (m³)"
                    stroke="#0F766E"
                    strokeWidth={2.5}
                    fill="url(#volumeGradient)"
                    dot={{ r: 4, fill: '#0F766E', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#0F766E', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-muted text-center" style={{ padding: 40 }}>No data yet</p>}
          </div>
        </div>
      </div>

      {/* Trends row: Volume by Permittee + Material Breakdown */}
      <div className="grid-2" style={{ marginBottom: 24 }}>

        {/* Multi-line — Volume by Permittee over Time */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Volume by Permittee</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{periodLabel} · top quarries</span>
          </div>
          <div className="card-body">
            {quarryLineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={quarryLineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" fontSize={12} tick={{ fill: 'var(--text-tertiary)' }} />
                  <YAxis fontSize={12} tick={{ fill: 'var(--text-tertiary)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }}
                  />
                  {quarryNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      name={name}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-muted text-center" style={{ padding: 40 }}>No data yet</p>}
          </div>
        </div>

        {/* Donut — Material Breakdown */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Material Breakdown</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>By volume · m³</span>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pieData.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: item.fill, flexShrink: 0
                      }} />
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{item.name}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {Number(item.value).toLocaleString()}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-muted text-center" style={{ padding: 40, width: '100%' }}>No data yet</p>}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header"><h3>Recent Activity</h3></div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Permittee Name</th><th>Volume</th><th>Status</th></tr>
            </thead>
            <tbody>
              {recent_hauling.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium" style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{r.tracking_code}</td>
                  <td>{r.quarry}</td>
                  <td>{r.volume} m³</td>
                  <td>
                    <span className={`badge ${r.status === 'verified' ? 'badge-success' : r.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={recent_hauling_meta} onPageChange={setRecentPage} />
      </div>
    </div>
  );
}
