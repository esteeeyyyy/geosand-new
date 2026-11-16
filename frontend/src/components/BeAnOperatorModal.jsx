import { useState, useRef } from 'react';
import { ArrowLeft, Building2, Send, CheckCircle2, Upload, FileText, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { submitOperatorApplication } from '../api/operatorApplications';
import toast from 'react-hot-toast';

export default function BeAnOperatorPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    applicant_name: '',
    company_name: '',
    email: '',
    phone: '',
    quarry_location: '',
    permit_number: '',
    remarks: '',
  });
  const [documentFile, setDocumentFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds 10 MB limit');
        return;
      }
      setDocumentFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitOperatorApplication({
        ...form,
        document: documentFile,
      });
      setSuccess(true);
      toast.success('Operator application submitted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setForm({
      applicant_name: '',
      company_name: '',
      email: '',
      phone: '',
      quarry_location: '',
      permit_number: '',
      remarks: '',
    });
    setDocumentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    navigate('/');
  };

  return (
    <main className="full-page-form public-operator-form-page">
      <div
        className="full-page-form-card animate-fadeIn"
        style={{ maxWidth: 900 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-light, #e6f4f1)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Be an Operator</h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Apply to register your quarry & manage hauling permits with MENRO GeoSand
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleClose}>
            <ArrowLeft size={16} /> Back to Map
          </button>
        </div>

        <div className="modal-body">
          {success ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 99,
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>Application Submitted!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 420, margin: '0 auto 20px' }}>
                Thank you for applying to be a registered Quarry Operator. Our MENRO Municipal Administration team will review your application and attached documents shortly.
              </p>
              <button className="btn btn-primary" onClick={handleClose}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Applicant Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Full name of owner/representative"
                    value={form.applicant_name}
                    onChange={(e) => setForm({ ...form, applicant_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Quarry Business Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Mindoro Sand & Gravel Corp."
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Email Address <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="operator@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+63 9XX XXX XXXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Quarry Location / Barangay <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Brgy. Alcate, Victoria"
                    value={form.quarry_location}
                    onChange={(e) => setForm({ ...form, quarry_location: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Permit / ECC No. <span className="text-muted">(optional)</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ECC-R04B-2024-XXXX"
                    value={form.permit_number}
                    onChange={(e) => setForm({ ...form, permit_number: e.target.value })}
                  />
                </div>
              </div>

              {/* ── File Document Attachment ── */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Upload size={14} /> Attach Permit / Business License Document <span className="text-muted">(optional)</span>
                </label>

                {!documentFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <Upload size={24} style={{ color: 'var(--primary)', marginBottom: 6 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
                      Click to upload document file
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                      PDF, DOC, DOCX, JPG, PNG — max 10 MB
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--border)',
                      background: 'var(--bg-secondary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                      <FileText size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {documentFile.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                          {(documentFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost btn-icon"
                      onClick={() => { setDocumentFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Additional Remarks / Operation Details <span className="text-muted">(optional)</span></label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Provide estimated extraction capacity, material types, or additional notes..."
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                />
              </div>

              <div className="modal-footer" style={{ padding: '12px 0 0', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Send size={16} /> {submitting ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
