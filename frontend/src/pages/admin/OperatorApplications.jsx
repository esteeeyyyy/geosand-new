import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getOperatorApplications,
  rejectOperatorApplication,
} from '../../api/operatorApplications';
import {
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  FileText,
  Download,
  X,
  ExternalLink,
  Eye,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  UserCheck,
  FileCheck,
  Plus,
} from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination';
import AdminPageActions from '../../components/AdminPageActions';

export default function AdminOperatorApplications() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'pending' | 'approved' | 'rejected'

  // View modal state
  const [viewModal, setViewModal] = useState(null); // application object

  // Rejection action form state. Approval proceeds through quarry mapping.
  const [actionModal, setActionModal] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = (p = page, q = search, s = statusFilter) => {
    setLoading(true);
    getOperatorApplications({ page: p, per_page: 10, search: q, status: s })
      .then((res) => {
        setApplications(res.data.applications || []);
        setMeta(res.data.meta);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchData(1, search, statusFilter);
  };

  const openAction = (app, type) => {
    setActionModal({ application: app, type });
    setAdminRemarks('');
  };

  const handleActionSubmit = async () => {
    if (!actionModal) return;

    if (!adminRemarks.trim()) {
      toast.error('Rejection remarks are required');
      return;
    }

    const ok = await confirm({
      title: 'Reject Application',
      message: `Are you sure you want to reject the operator application for "${actionModal.application.company_name}"?`,
      confirmText: 'Reject',
      type: 'danger',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      await rejectOperatorApplication(actionModal.application.id, { admin_remarks: adminRemarks });
      toast.success(`Application for ${actionModal.application.company_name} rejected.`);
      setActionModal(null);
      if (viewModal && viewModal.id === actionModal.application.id) {
        setViewModal(null);
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update application');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="badge badge-success"><CheckCircle size={12} /> Approved</span>;
      case 'rejected':
        return <span className="badge badge-danger"><XCircle size={12} /> Rejected</span>;
      default:
        return <span className="badge badge-warning"><Clock size={12} /> Pending Review</span>;
    }
  };

  const isImageFile = (filename = '') => {
    return /\.(jpg|jpeg|png|webp)$/i.test(filename);
  };

  return (
    <div className={`animate-fadeIn ${actionModal ? 'form-page-open' : ''}`}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Operator Applications</h1>
          <p>Review, view details, approve, or reject quarry operator registration requests</p>
        </div>
        <div className="flex gap-2 items-center no-print">
          <AdminPageActions />
          <button className="btn btn-primary" onClick={() => navigate('/?addQuarry=application')}>
            <Plus size={17} /> Add Quarry
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body filters-bar operator-application-filters" style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 0 }}>
          
          {/* Status Tabs */}
          <div className="filter-chip-group" style={{ display: 'flex', gap: 8 }}>
            {[
              { id: '', label: 'All Applications' },
              { id: 'pending', label: 'Pending' },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setStatusFilter(tab.id); setPage(1); }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <form className="filter-search-form" onSubmit={handleSearch} style={{ display: 'flex', gap: 8, maxWidth: 320, width: '100%' }}>
            <div className="search-box" style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search applicant or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 34, height: 36, fontSize: '0.85rem' }}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm" style={{ height: 36 }}>
              Search
            </button>
          </form>

        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="loader-container"><div className="spinner" /></div>
      ) : applications.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Building2 size={48} style={{ color: 'var(--gray-300)', marginBottom: 16 }} />
            <h3>No Operator Applications</h3>
            <p>No quarry operator registration applications match your filter criteria.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {applications.map((app) => (
            <div key={app.id} className="card" style={{ transition: 'all 0.15s' }}>
              <div className="card-body" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{app.company_name}</h3>
                      {getStatusBadge(app.status)}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Applicant: <strong>{app.applicant_name}</strong> • Email: <a href={`mailto:${app.email}`} style={{ color: 'var(--primary)' }}>{app.email}</a> • Phone: <strong>{app.phone}</strong>
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setViewModal(app)}>
                      <Eye size={16} /> View Application
                    </button>
                  </div>
                </div>

                <div className="grid-3" style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', gap: 12 }}>
                  <div>
                    <span className="text-muted">Quarry Location:</span><br />
                    <strong>{app.quarry_location}</strong>
                  </div>
                  <div>
                    <span className="text-muted">ECC / Permit Number:</span><br />
                    <strong>{app.permit_number || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Application Date:</span><br />
                    <strong>{new Date(app.created_at).toLocaleString()}</strong>
                  </div>
                </div>

                {/* Submitted Document Attachment */}
                {app.document_url && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="text-muted text-sm">Attached Document:</span>
                    <a
                      href={app.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '4px 10px' }}
                    >
                      <FileText size={14} /> {app.document_original_name || 'Download Document'} <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Remarks / Reviewer details */}
                {app.remarks && (
                  <p className="text-sm text-muted" style={{ margin: '10px 0 0' }}>
                    <strong>Applicant Remarks:</strong> {app.remarks}
                  </p>
                )}

                {app.status !== 'pending' && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Reviewed by <strong>{app.reviewer?.name || 'Admin'}</strong> on {new Date(app.reviewed_at).toLocaleString()}</span>
                    {app.admin_remarks && (
                      <span style={{ display: 'block', marginTop: 4 }}>
                        <strong>Admin Remarks:</strong> {app.admin_remarks}
                      </span>
                    )}
                  </div>
                )}

              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination meta={meta} onPageChange={setPage} />

      {/* ── VIEW APPLICATION MODAL ── */}
      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(null)}>
          <div className="modal animate-scaleIn" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--primary-light, #e6f4f1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{viewModal.company_name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Submitted {new Date(viewModal.created_at).toLocaleString()}
                    </span>
                    {getStatusBadge(viewModal.status)}
                  </div>
                </div>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setViewModal(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Section 1: Business & Location Info */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', fontWeight: 700 }}>
                  Quarry & Business Info
                </h4>
                <div className="grid-2" style={{ background: 'var(--bg-secondary)', padding: '14px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', gap: 14 }}>
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Company Name:</span><br />
                    <strong>{viewModal.company_name}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Location / Barangay:</span><br />
                    <strong>{viewModal.quarry_location}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>ECC / Permit Number:</span><br />
                    <strong>{viewModal.permit_number || 'None provided'}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Submission Timestamp:</span><br />
                    <strong>{new Date(viewModal.created_at).toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Section 2: Applicant Contact Info */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', fontWeight: 700 }}>
                  Applicant Contact Info
                </h4>
                <div className="grid-3" style={{ background: 'var(--bg-secondary)', padding: '14px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', gap: 14 }}>
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Full Name:</span><br />
                    <strong>{viewModal.applicant_name}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Email Address:</span><br />
                    <a href={`mailto:${viewModal.email}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{viewModal.email}</a>
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Phone Number:</span><br />
                    <a href={`tel:${viewModal.phone}`} style={{ color: 'var(--text-main)', fontWeight: 600 }}>{viewModal.phone}</a>
                  </div>
                </div>
              </div>

              {/* Section 3: Attached Document */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', fontWeight: 700 }}>
                  Attached Permit / License Document
                </h4>
                {viewModal.document_url ? (
                  <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isImageFile(viewModal.document_original_name || viewModal.document_path) ? 12 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileText size={22} style={{ color: 'var(--primary)' }} />
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem' }}>
                            {viewModal.document_original_name || 'Uploaded Document'}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                            File uploaded with operator application
                          </p>
                        </div>
                      </div>
                      <a
                        href={viewModal.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <ExternalLink size={14} /> View Document
                      </a>
                    </div>

                    {/* Inline Image Preview if document is an image */}
                    {isImageFile(viewModal.document_original_name || viewModal.document_path) && (
                      <div style={{ marginTop: 10, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img
                          src={viewModal.document_url}
                          alt="Submitted Document Preview"
                          style={{ width: '100%', maxHeight: 260, objectFit: 'contain', background: '#000', display: 'block' }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                    No file document was attached with this application.
                  </div>
                )}
              </div>

              {/* Section 4: Applicant Remarks */}
              {viewModal.remarks && (
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Operation Notes / Remarks:
                  </h4>
                  <div style={{ padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                    {viewModal.remarks}
                  </div>
                </div>
              )}

              {/* Section 5: Review Log */}
              {viewModal.status !== 'pending' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 700, color: viewModal.status === 'approved' ? '#15803d' : '#b91c1c' }}>
                    Review Details ({viewModal.status.toUpperCase()})
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Reviewed by <strong>{viewModal.reviewer?.name || 'Admin'}</strong> on {new Date(viewModal.reviewed_at).toLocaleString()}
                  </p>
                  {viewModal.admin_remarks && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-main)', background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 6 }}>
                      <strong>Admin Notes:</strong> {viewModal.admin_remarks}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setViewModal(null)}>
                Close
              </button>

              {viewModal.status === 'pending' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-danger" onClick={() => { const target = viewModal; setViewModal(null); openAction(target, 'reject'); }}>
                    <XCircle size={16} /> Reject Application
                  </button>
                  <button className="btn btn-primary" onClick={() => navigate(`/?addQuarry=application&applicationId=${viewModal.id}`)}>
                    <CheckCircle size={16} /> Approve Application
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REJECTION FORM ── */}
      {actionModal && (
        <div className="full-page-form">
          <div className="full-page-form-card" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>
                Reject Operator Application
              </h2>
              <button className="btn-ghost btn-icon" onClick={() => setActionModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Application for: <strong>{actionModal.application.company_name}</strong> ({actionModal.application.applicant_name})
              </p>

              <div className="form-group">
                <label className="form-label">
                  Admin Remarks <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="State reason for rejection..."
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer" style={{ padding: '12px 0 0', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary" onClick={() => setActionModal(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleActionSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Processing…' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
