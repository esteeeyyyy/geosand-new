import api from './axios';

export const getUsers = (params) => api.get('/admin/users', { params });
export const createUser = (data) => api.post('/admin/users', data);
export const updateUser = (id, data) => api.put(`/admin/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/admin/users/${id}`);

// Operator staff management
export const getOperatorStaff = (params) => api.get('/operator/staff', { params });
export const createOperatorStaff = (data) => api.post('/operator/staff', data);
export const updateOperatorStaff = (id, data) => api.put(`/operator/staff/${id}`, data);
export const deleteOperatorStaff = (id) => api.delete(`/operator/staff/${id}`);
