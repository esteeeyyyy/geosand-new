import api from './axios';

export const getCheckpoints = (params) => api.get('/checkpoints', { params });

// Admin
export const createCheckpoint = (data) => api.post('/admin/checkpoints', data);
export const updateCheckpoint = (id, data) => api.put(`/admin/checkpoints/${id}`, data);
export const deleteCheckpoint = (id) => api.delete(`/admin/checkpoints/${id}`);

// Checkpoint Officer
export const getPendingRecords = (params) => api.get('/checkpoint/pending', { params });
export const getVerificationHistory = (params) => api.get('/checkpoint/history', { params });

/**
 * Verify or reject a hauling record.
 * @param {number} id  - HaulingRecord ID
 * @param {{ checkpoint_id, status, remarks, permit_photo?: File }} data
 */
export const verifyRecord = (id, data) => {
  const fd = new FormData();
  fd.append('checkpoint_id', data.checkpoint_id);
  fd.append('status', data.status);
  if (data.remarks)      fd.append('remarks', data.remarks);
  if (data.permit_photo) fd.append('permit_photo', data.permit_photo);
  return api.post(`/checkpoint/verify/${id}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const directVerifyRecord = (data) => {
  const fd = new FormData();
  fd.append('quarry_id', data.quarry_id);
  fd.append('truck_plate_number', data.truck_plate_number);
  fd.append('volume_cubic_meters', data.volume_cubic_meters);
  fd.append('material_type', data.material_type);
  fd.append('destination', data.destination);
  if (data.driver_name)  fd.append('driver_name', data.driver_name);
  if (data.notes)        fd.append('notes', data.notes);
  fd.append('checkpoint_id', data.checkpoint_id);
  fd.append('status', data.status);
  if (data.remarks)      fd.append('remarks', data.remarks);
  if (data.permit_photo) fd.append('permit_photo', data.permit_photo);
  return api.post('/checkpoint/direct-verify', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
