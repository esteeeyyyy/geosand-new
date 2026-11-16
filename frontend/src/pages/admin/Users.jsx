import { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/users';
import { getQuarries } from '../../api/quarries';
import { Plus, Search, Edit2, Trash2, X, Mountain } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination';
import AdminPageActions from '../../components/AdminPageActions';
import SearchableSelect from '../../components/SearchableSelect';
import PasswordInput from '../../components/PasswordInput';

export default function AdminUsers() {
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [quarries, setQuarries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'quarry_operator', quarry_id: '', phone: '', is_active: true });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchUsers = (p = page) => {
    setLoading(true);
    Promise.all([getUsers({ search, page: p, per_page: 10 }), getQuarries({ per_page: 100 })])
      .then(([usersRes, quarriesRes]) => {
        setUsers(usersRes.data.users);
        setMeta(usersRes.data.meta);
        setQuarries(quarriesRes.data.quarries);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(1); setPage(1); }, [search]);
  useEffect(() => { fetchUsers(); }, [page]);

  const handleSearch = (e) => { e.preventDefault(); fetchUsers(); };

  const openCreate = () => {
    setForm({ name: '', email: '', password: '', role: 'quarry_operator', quarry_id: '', phone: '', is_active: true });
    setEditId(null);
    setModal('create');
  };

  const openEdit = (user) => {
    setForm({ name: user.name, email: user.email, password: '', role: user.role, quarry_id: user.quarry_id || '', phone: user.phone || '', is_active: user.is_active });
    setEditId(user.id);
    setModal('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!['quarry_operator', 'quarry_staff'].includes(payload.role)) {
        payload.quarry_id = null;
      }
      if (modal === 'edit') {
        await updateUser(editId, payload);
        toast.success('User updated');
      } else {
        await createUser(payload);
        toast.success('User created');
      }
      setModal(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete User', message: 'Are you sure you want to delete this user? This action cannot be undone.', confirmText: 'Delete', type: 'danger' });
    if (!ok) return;
    try {
      await deleteUser(id);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting user');
    }
  };

  const roleLabel = { admin: 'Administrator', quarry_operator: 'Quarry Operator', quarry_staff: 'Quarry Staff', checkpoint_officer: 'Checkpoint Officer' };
  const roleBadge = (role) => {
    const cls = role === 'admin' ? 'badge-primary' : role === 'quarry_operator' ? 'badge-info' : role === 'quarry_staff' ? 'badge-success' : 'badge-warning';
    return <span className={`badge ${cls}`}>{roleLabel[role]}</span>;
  };

  // Check quarry availability for the form
  const needsQuarry = ['quarry_operator', 'quarry_staff'].includes(form.role);
  const getAvailableQuarries = () => {
    if (form.role === 'quarry_operator') {
      // Only quarries without an operator (or the current user's quarry if editing)
      return quarries.filter(q => {
        const hasOperator = q.operator && q.operator.id !== editId;
        return !hasOperator;
      });
    }
    if (form.role === 'quarry_staff') {
      // Only quarries with fewer than 5 staff
      return quarries.filter(q => {
        const staffCount = (q.staff || []).filter(s => s.id !== editId).length;
        return staffCount < 5;
      });
    }
    return quarries;
  };

  return (
    <div className={`animate-fadeIn ${modal ? 'form-page-open' : ''}`}>
      <div className="page-header">
        <div><h1>Users</h1><p>Manage system users and roles</p></div>
        <div className="flex gap-2 items-center no-print">
          <AdminPageActions />
          <button className="btn btn-primary" onClick={openCreate}><Plus size={18} /> Add User</button>
        </div>
      </div>

      <div className="filters-bar">
        <form className="search-input" onSubmit={handleSearch}>
          <Search className="search-icon" />
          <input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>

      <div className="table-container">
        {loading ? <div className="loader-container"><div className="spinner" /></div> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Assigned Permittee</th><th>Status</th><th style={{width:100}}>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td className="text-muted">{u.email}</td>
                  <td>{roleBadge(u.role)}</td>
                  <td>
                    {u.quarry ? (
                      <div className="flex items-center gap-1">
                        <Mountain size={14} style={{ color: 'var(--primary)' }} />
                        <span className="text-sm">{u.quarry.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td><span className={`badge ${u.is_active?'badge-success':'badge-danger'}`}>{u.is_active?'Active':'Inactive'}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-ghost btn-icon" onClick={() => openEdit(u)}><Edit2 size={16} /></button>
                      <button className="btn-ghost btn-icon" onClick={() => handleDelete(u.id)} style={{color:'var(--danger)'}}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{padding:40}}>No users found</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} onPageChange={setPage} />

      {modal && (
        <div className="full-page-form">
          <div className="full-page-form-card">
            <div className="modal-header">
              <h2>{modal === 'edit' ? 'Edit User' : 'Add User'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{modal === 'edit' ? 'Password (leave blank to keep)' : 'Password'}</label>
                  <PasswordInput value={form.password} onChange={(e) => setForm({...form, password: e.target.value})}
                    placeholder={modal === 'edit' ? 'Leave blank to keep current' : 'Default: password'} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="user-role">Role *</label>
                  <SearchableSelect
                    id="user-role"
                    value={form.role}
                    options={[
                      { value: 'admin', label: 'Administrator' },
                      { value: 'quarry_operator', label: 'Quarry Operator' },
                      { value: 'quarry_staff', label: 'Quarry Staff' },
                      { value: 'checkpoint_officer', label: 'Checkpoint Officer' },
                    ]}
                    onChange={(role) => setForm({ ...form, role, quarry_id: '' })}
                    required
                  />
                </div>

                {/* Quarry Assignment - only for operator/staff */}
                {needsQuarry && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="user-quarry-assignment">
                      <Mountain size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      Assign to Permittee *
                    </label>
                    <SearchableSelect
                      id="user-quarry-assignment"
                      value={form.quarry_id}
                      options={getAvailableQuarries().map((quarry) => ({
                        value: quarry.id,
                        label: `${quarry.name} ${form.role === 'quarry_staff' ? `(${(quarry.staff || []).length}/5 staff)` : quarry.operator ? '(has operator)' : '(no operator)'}`,
                      }))}
                      onChange={(quarryId) => setForm({ ...form, quarry_id: quarryId })}
                      placeholder="Select a permittee..."
                      searchPlaceholder="Search permittees..."
                      emptyMessage="No available permittee found."
                      required
                    />
                    <span className="text-xs text-muted">
                      {form.role === 'quarry_operator'
                        ? 'Each quarry can have 1 operator account.'
                        : 'Each quarry can have up to 5 staff accounts.'}
                    </span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({...form, is_active: e.target.checked})} /> Active
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
