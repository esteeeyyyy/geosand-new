import api from './axios';

// Admin
export const getAllHaulingRecords = (params) => api.get('/admin/hauling-records', { params });
export const getHaulingRecord = (id) => api.get(`/admin/hauling-records/${id}`);

// Operator
export const getMyHaulingRecords = (params) => api.get('/operator/hauling-records', { params });
export const createHaulingRecord = (data) => api.post('/operator/hauling-records', data);
export const updateVehicleLocation = (id, data) => api.post(`/operator/hauling-records/${id}/location`, data);
export const getOperatorAnalytics = (params) => api.get('/operator/analytics', { params });

// Staff
export const getStaffHaulingRecords = (params) => api.get('/staff/hauling-records', { params });
export const createStaffHaulingRecord = (data) => api.post('/staff/hauling-records', data);
export const updateStaffVehicleLocation = (id, data) => api.post(`/staff/hauling-records/${id}/location`, data);
