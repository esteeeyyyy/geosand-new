import api from './axios';

export const getBackups = () => api.get('/admin/system/backups');
export const createBackup = () => api.post('/admin/system/backups');
export const restoreBackup = (file, confirmation) => api.post('/admin/system/restore', { file, confirmation });

export const downloadBackup = async (filename) => {
  const response = await api.get(`/admin/system/backups/${encodeURIComponent(filename)}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
