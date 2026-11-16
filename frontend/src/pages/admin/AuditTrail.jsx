import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getAuditLogs, getAuditFilters } from '../../api/auditLogs';
import { Search, Filter, ChevronDown, Shield, User, Mountain, Truck, ClipboardCheck, LogIn, LogOut, FileJson, X } from 'lucide-react';
import Pagination from '../../components/Pagination';
import AdminPageActions from '../../components/AdminPageActions';
import SearchableSelect from '../../components/SearchableSelect';
import useClientPagination from '../../hooks/useClientPagination';

// ─── helpers ────────────────────────────────────────────────────────────────

const ACTION_META = {
  login:        { label: 'Login',          color: '#2563EB', bg: '#EFF6FF' },
  logout:       { label: 'Logout',         color: '#6B7280', bg: '#F3F4F6' },
  created:      { label: 'Created',        color: '#059669', bg: '#ECFDF5' },
  updated:      { label: 'Updated',        color: '#D97706', bg: '#FFFBEB' },
  deleted:      { label: 'Deleted',        color: '#DC2626', bg: '#FEF2F2' },
  submitted:    { label: 'Submitted',      color: '#7C3AED', bg: '#F5F3FF' },
  verified:     { label: 'Verified',       color: '#059669', bg: '#ECFDF5' },
  rejected:     { label: 'Rejected',       color: '#DC2626', bg: '#FEF2F2' },
  uploaded_gis: { label: 'GIS Uploaded',   color: '#0F766E', bg: '#F0FDFA' },
  deleted_gis:  { label: 'GIS Removed',    color: '#DC2626', bg: '#FEF2F2' },
};

const MODULE_ICON = {
  Auth:          LogIn,
  Quarry:        Mountain,
  User:          User,
  Checkpoint:    Shield,
  HaulingRecord: Truck,
};

const MODULE_COLOR = {
  Auth:          '#2563EB',
  Quarry:        '#0F766E',
  User:          '#7C3AED',
  Checkpoint:    '#D97706',
  HaulingRecord: '#6B7280',
};

const ROLE_LABEL = {
  admin:             'Admin',
  quarry_operator:   'Operator',
  quarry_staff:      'Staff',
  checkpoint_officer:'Officer',
};

function ActionBadge({ action }) {
  const meta = ACTION_META[action] || { label: action, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700,
      color: meta.color, background: meta.bg,
    }}>
      {meta.label}
    </span>
  );
}

function ModuleChip({ module }) {
  const Icon = MODULE_ICON[module] || Shield;
  const color = MODULE_COLOR[module] || '#6B7280';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color, fontWeight: 600 }}>
      <Icon size={12} /> {module}
    </span>
  );
}

function ChangesPopover({ changes }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);

  // Flat extras (e.g. remarks, file)
  const extras = Object.entries(changes || {}).filter(([k]) => k !== 'before' && k !== 'after');
  const before = changes?.before || {};
  const after  = changes?.after  || {};
  const keys   = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const hasChanges = keys.length > 0 || extras.length > 0;
  const changesPagination = useClientPagination(keys);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(360, Math.max(0, window.innerWidth - gutter * 2));
    const measuredHeight = popoverRef.current?.offsetHeight || 240;
    const spaceBelow = window.innerHeight - rect.bottom - gutter;
    const spaceAbove = rect.top - gutter;
    const placeBelow = spaceBelow >= Math.min(measuredHeight, 240) || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(120, (placeBelow ? spaceBelow : spaceAbove) - 4);
    const left = Math.min(
      Math.max(gutter, rect.right - width),
      Math.max(gutter, window.innerWidth - width - gutter),
    );
    const top = placeBelow
      ? rect.bottom + 4
      : Math.max(gutter, rect.top - Math.min(measuredHeight, maxHeight) - 4);

    setPosition({ top, left, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (!hasChanges) return <span className="text-muted text-xs">—</span>;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 600,
          color: 'var(--primary)', background: 'var(--primary-50)', border: 'none', cursor: 'pointer',
        }}
      >
        View <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
      </button>
      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setOpen(false)} />
          <div ref={popoverRef} role="dialog" aria-label="Audit log changes" style={{
            position: 'fixed',
            top: position?.top ?? 12,
            left: position?.left ?? 12,
            width: position?.width ?? 'min(360px, calc(100vw - 24px))',
            maxHeight: position?.maxHeight ?? 'calc(100vh - 24px)',
            overflow: 'auto',
            zIndex: 1001,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}>
            {/* Diff table */}
            {keys.length > 0 && (
              <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, paddingBottom: 4, width: '30%' }}>Field</th>
                    <th style={{ textAlign: 'left', color: '#DC2626', fontWeight: 600, paddingBottom: 4 }}>Before</th>
                    <th style={{ textAlign: 'left', color: '#059669', fontWeight: 600, paddingBottom: 4 }}>After</th>
                  </tr>
                </thead>
                <tbody>
                  {changesPagination.pageItems.map(k => (
                    <tr key={k} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '3px 0', color: 'var(--text-secondary)', fontWeight: 500 }}>{k}</td>
                      <td style={{ padding: '3px 4px', color: '#DC2626', wordBreak: 'break-all' }}>{String(before[k] ?? '—')}</td>
                      <td style={{ padding: '3px 4px', color: '#059669', wordBreak: 'break-all' }}>{String(after[k]  ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination meta={changesPagination.meta} onPageChange={changesPagination.setPage} />
            {/* Extra flat fields */}
            {extras.map(([k, v]) => (
              <p key={k} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                <strong>{k}:</strong> {String(v ?? '—')}
              </p>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AuditTrail() {
  const [logs,    setLogs]    = useState([]);
  const [meta,    setMeta]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);

  // Filters
  const [search,   setSearch]   = useState('');
  const [module,   setModule]   = useState('');
  const [action,   setAction]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  // Filter options from server
  const [filterOpts, setFilterOpts] = useState({ modules: [], actions: [] });

  useEffect(() => {
    getAuditFilters().then(r => setFilterOpts(r.data)).catch(() => {});
  }, []);

  const fetchLogs = useCallback((p = 1) => {
    setLoading(true);
    getAuditLogs({
      page: p, per_page: 10,
      search: search || undefined,
      module: module || undefined,
      action: action || undefined,
      date_from: dateFrom || undefined,
      date_to:   dateTo   || undefined,
    })
      .then(r => { setLogs(r.data.logs); setMeta(r.data.meta); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, module, action, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(1); setPage(1); }, [search, module, action, dateFrom, dateTo]);
  useEffect(() => { fetchLogs(page); }, [page]);

  const clearFilters = () => {
    setSearch(''); setModule(''); setAction(''); setDateFrom(''); setDateTo('');
  };
  const hasFilters = search || module || action || dateFrom || dateTo;

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Audit Trail</h1>
          <p>Complete log of all system actions and data changes</p>
        </div>
        <AdminPageActions />
      </div>

      {/* Filters bar */}
      <div className="filters-bar audit-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {/* Search */}
        <form className="search-input" onSubmit={e => e.preventDefault()} style={{ flex: '1 1 200px', minWidth: 180 }}>
          <Search className="search-icon" />
          <input
            placeholder="Search user, subject, module…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </form>

        {/* Module */}
        <SearchableSelect
          id="audit-module-filter"
          value={module}
          onChange={setModule}
          options={[
            { value: '', label: 'All Modules' },
            ...filterOpts.modules.map((item) => ({ value: item, label: item })),
          ]}
          ariaLabel="Filter audit trail by module"
          containerStyle={{ minWidth: 150, width: 180 }}
          style={{ minWidth: 130, height: 38, fontSize: '0.85rem' }}
        />

        {/* Action */}
        <SearchableSelect
          id="audit-action-filter"
          value={action}
          onChange={setAction}
          options={[
            { value: '', label: 'All Actions' },
            ...filterOpts.actions.map((item) => ({ value: item, label: ACTION_META[item]?.label || item })),
          ]}
          ariaLabel="Filter audit trail by action"
          containerStyle={{ minWidth: 150, width: 180 }}
          style={{ minWidth: 130, height: 38, fontSize: '0.85rem' }}
        />

        {/* Date range */}
        <input
          type="date"
          className="form-input"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          style={{ width: 140, height: 38, fontSize: '0.85rem' }}
          title="From date"
        />
        <span className="filter-range-separator" style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>to</span>
        <input
          type="date"
          className="form-input"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{ width: 140, height: 38, fontSize: '0.85rem' }}
          title="To date"
        />

        {hasFilters && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={clearFilters}
            style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Summary bar */}
      {meta && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 10 }}>
          Showing <strong>{logs.length}</strong> of <strong>{meta.total}</strong> records
        </p>
      )}

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="loader-container"><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Timestamp</th>
                <th>User</th>
                <th style={{ width: 110 }}>Module</th>
                <th style={{ width: 110 }}>Action</th>
                <th>Subject</th>
                <th style={{ width: 90 }}>Changes</th>
                <th style={{ width: 120 }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{log.user_name}</span>
                      {log.user_role && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                          {ROLE_LABEL[log.user_role] || log.user_role}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><ModuleChip module={log.module} /></td>
                  <td><ActionBadge action={log.action} /></td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      {log.subject || <span className="text-muted">—</span>}
                    </span>
                  </td>
                  <td><ChangesPopover changes={log.changes} /></td>
                  <td className="text-xs font-mono text-muted">{log.ip_address || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>
                    No audit log entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Pagination meta={meta} onPageChange={p => setPage(p)} />
    </div>
  );
}
