import { useCallback, useEffect, useState } from 'react';
import { Archive, CalendarClock, DatabaseBackup, Download, HardDrive, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBackup, downloadBackup, getBackups, restoreBackup } from '../../api/system';
import { useConfirm } from '../../context/ConfirmContext';
import AdminPageActions from '../../components/AdminPageActions';
import Pagination from '../../components/Pagination';
import useClientPagination from '../../hooks/useClientPagination';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export default function SystemMaintenance() {
  const confirm = useConfirm();
  const [data, setData] = useState({ backups: [] });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const backupsPagination = useClientPagination(data.backups || []);

  const load = useCallback(() => {
    setLoading(true);
    getBackups()
      .then((response) => setData(response.data))
      .catch(() => toast.error('Unable to load backup status'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const handleBackup = async () => {
    setWorking(true);
    try {
      await createBackup();
      toast.success('Backup snapshot created');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Backup failed');
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async (backup) => {
    const approved = await confirm({
      title: 'Restore system data?',
      message: `This will replace current database records with ${backup.name}. A fresh safety backup will be created first. Continue?`,
      confirmText: 'Restore snapshot',
      type: 'danger',
    });
    if (!approved) return;

    setWorking(true);
    try {
      await restoreBackup(backup.name, 'RESTORE');
      toast.success('Recovery completed successfully');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Recovery failed');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1>Backup & Recovery</h1>
          <p>Protect operational records and recover the system from verified snapshots.</p>
        </div>
        <div className="flex gap-2 items-center no-print">
          <AdminPageActions />
          <button className="btn btn-primary" onClick={handleBackup} disabled={working}>
            {working ? <RefreshCw size={18} className="spin" /> : <DatabaseBackup size={18} />}
            Create backup
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon primary"><Archive size={23} /></div>
          <div className="stat-content"><h3>{data.backups?.length || 0}</h3><p>Available snapshots</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><ShieldCheck size={23} /></div>
          <div className="stat-content"><h3>{data.recovery_ready ? 'Ready' : 'Not ready'}</h3><p>Recovery status</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon info"><CalendarClock size={23} /></div>
          <div className="stat-content"><h3>Daily</h3><p>{data.schedule || '01:00 Asia/Manila'}</p></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <HardDrive size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>Automated protection is enabled</h3>
            <p className="text-sm text-muted">A full JSON snapshot is scheduled every day and the {data.retention || '30 newest snapshots'} are retained. Every backup and restore action is recorded in the audit trail.</p>
          </div>
        </div>
      </div>

      <div className="table-container">
        {loading ? <div className="loader-container"><div className="spinner" /></div> : (
          <table className="table">
            <thead><tr><th>Snapshot</th><th>Created</th><th>Size</th><th style={{ width: 230 }}>Actions</th></tr></thead>
            <tbody>
              {backupsPagination.pageItems.map((backup) => (
                <tr key={backup.name}>
                  <td className="font-medium" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{backup.name}</td>
                  <td className="text-sm">{new Date(backup.created_at).toLocaleString()}</td>
                  <td className="text-sm text-muted">{formatBytes(backup.size_bytes)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => downloadBackup(backup.name)} disabled={working}><Download size={14} /> Download</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleRestore(backup)} disabled={working}><RotateCcw size={14} /> Restore</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data.backups?.length && <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 48 }}>No snapshots yet. Create the first system backup.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={backupsPagination.meta} onPageChange={backupsPagination.setPage} />
    </div>
  );
}
