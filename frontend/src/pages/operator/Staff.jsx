import { useEffect, useState } from 'react';
import { getOperatorStaff, createOperatorStaff, updateOperatorStaff, deleteOperatorStaff } from '../../api/users';
import { Plus, Search, Edit2, Trash2, X, UserPlus, Mail, Phone } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination';

export default function OperatorStaff() {
  const confirm = useConfirm();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editActive, setEditActive] = useState(true);

  const fetchStaff = (p = page) => {
    setLoading(true);
    getOperatorStaff({ search, page: p, per_page: 10 })
      .then(res => {
        setStaff(res.data.staff);
        setMeta(res.data.meta);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStaff(1); setPage(1); }, [search]);
  useEffect(() => { fetchStaff(); }, [page]);

  const openCreate = () => {
    setForm({ name: '', email: '', password: '', phone: '' });
    setEditId(null);
    setEditActive(true);
    setModal('create');
  };

  const openEdit = (user) => {
    setForm({ name: user.name, email: user.email, password: '', phone: user.phone || '' });
    setEditId(user.id);
    setEditActive(user.is_active);
    setModal('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'edit') {
        const payload = { ...form, is_active: editActive };
        if (!payload.password) delete payload.password;
        await updateOperatorStaff(editId, payload);
        toast.success('Staff member updated');
      } else {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await createOperatorStaff(payload);
        toast.success('Staff member registered');
      }
      setModal(null);
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving staff');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Remove Staff',
      message: 'Are you sure you want to remove this staff member? This action cannot be undone.',
      confirmText: 'Remove',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteOperatorStaff(id);
      toast.success('Staff member removed');
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error removing staff');
    }
  };

  return (
    <div className={`animate-fadeIn ${modal ? 'form-page-open' : ''}`}>
      <div className="page-header">
        <div>
          <h1>My Staff</h1>
          <p>Register and manage your quarry staff members</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} disabled={meta && meta.total >= 5}>
          <UserPlus size={18} /> Add Staff
        </button>
      </div>

      {meta && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 'var(--radius-md)',
          background: meta.total >= 5 ? 'var(--warning-light)' : 'var(--primary-50)',
          color: meta.total >= 5 ? '#92400E' : 'var(--primary)',
          fontSize: '0.8125rem', fontWeight: 500, marginBottom: 16,
        }}>
          {meta.total}/5 staff slots used
        </div>
      )}

      <div className="filters-bar">
        <form className="search-input" onSubmit={(e) => { e.preventDefault(); fetchStaff(); }}>
          <Search className="search-icon" />
          <input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>

      <div className="table-container">
        {loading ? <div className="loader-container"><div className="spinner" /></div> : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-muted">
                    <div className="flex items-center gap-1">
                      <Mail size={14} style={{ color: 'var(--text-tertiary)' }} />
                      {s.email}
                    </div>
                  </td>
                  <td>
                    {s.phone ? (
                      <div className="flex items-center gap-1">
                        <Phone size={14} style={{ color: 'var(--text-tertiary)' }} />
                        <span className="text-sm">{s.phone}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-ghost btn-icon" onClick={() => openEdit(s)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn-ghost btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>
                    No staff members yet. Click "Add Staff" to register your first staff member.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} onPageChange={setPage} />

      {/* Full-page create/edit form */}
      {modal && (
        <div className="full-page-form">
          <div className="full-page-form-card">
            <div className="modal-header">
              <h2>{modal === 'edit' ? 'Edit Staff' : 'Register Staff'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setModal(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Juan Dela Cruz"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="staff@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {modal === 'edit' ? 'Password (leave blank to keep)' : 'Password'}
                  </label>
                  <input
                    className="form-input"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={modal === 'edit' ? 'Leave blank to keep current' : 'Default: password'}
                  />
                  {modal === 'create' && (
                    <span className="text-xs text-muted">If left empty, default password will be "password"</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="09XX XXX XXXX"
                  />
                </div>
                {modal === 'edit' && (
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                      />
                      Active
                    </label>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : modal === 'edit' ? 'Update' : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
