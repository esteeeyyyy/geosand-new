import api from './axios';

export const getMonitoringRecords = (params) => api.get('/admin/monitoring-records', { params });
export const createMonitoringRecord = (data) => api.post('/admin/monitoring-records', data);
export const updateMonitoringRecord = (id, data) => api.put(`/admin/monitoring-records/${id}`, data);
export const deleteMonitoringRecord = (id) => api.delete(`/admin/monitoring-records/${id}`);
