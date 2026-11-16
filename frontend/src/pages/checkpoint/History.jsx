import { useEffect, useState } from 'react';
import { getVerificationHistory } from '../../api/checkpoints';
import Pagination from '../../components/Pagination';
import { Camera, X } from 'lucide-react';

export default function CheckpointHistory() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const fetchData = (p = page) => {
    setLoading(true);
    getVerificationHistory({ page: p, per_page: 10 })
      .then((res) => { setVerifications(res.data.verifications); setMeta(res.data.meta); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]);

  const statusBadge = (s) => (
    <span className={`badge ${s === 'verified' ? 'badge-success' : 'badge-danger'}`}>{s}</span>
  );

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div><h1>Verification History</h1><p>Your past verifications</p></div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loader-container"><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tracking Code</th>
                <th>Permittee Name</th>
                <th>Operator</th>
                <th>Volume</th>
                <th>Checkpoint</th>
                <th>Decision</th>
                <th>Permit Photo</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {verifications.map((v) => (
                <tr key={v.id}>
                  <td className="text-sm text-muted">
                    {v.hauling_record?.hauled_at
                      ? new Date(v.hauling_record.hauled_at).toLocaleDateString('en-PH')
                      : '—'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }} className="font-medium">{v.hauling_record?.tracking_code}</td>
                  <td>{v.hauling_record?.quarry?.name}</td>
                  <td>{v.hauling_record?.operator?.name}</td>
                  <td>{v.hauling_record?.volume_cubic_meters} m³</td>
                  <td>{v.checkpoint?.name}</td>
                  <td>{statusBadge(v.status)}</td>
                  <td>
                    {v.permit_photo_url ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}
                        onClick={() => setPreviewPhoto({ url: v.permit_photo_url, code: v.hauling_record?.tracking_code })}
                      >
                        <Camera size={14} /> View Photo
                      </button>
                    ) : (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </td>
                  <td className="text-sm text-muted">{v.remarks || '—'}</td>
                </tr>
              ))}
              {verifications.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted" style={{ padding: 40 }}>No verification history yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} onPageChange={setPage} />

      {/* ── Photo Lightbox Modal ── */}
      {previewPhoto && (
        <div className="modal-overlay" onClick={() => setPreviewPhoto(null)}>
          <div className="modal" style={{ maxWidth: 640, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Permit Photo — <span style={{ fontFamily: 'monospace' }}>{previewPhoto.code}</span></h3>
              <button className="btn-ghost btn-icon" onClick={() => setPreviewPhoto(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: 0 }}>
              <img
                src={previewPhoto.url}
                alt="Permit Photo"
                style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

