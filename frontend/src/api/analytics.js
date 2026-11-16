import api from './axios';

export const getAnalytics = (params) => api.get('/admin/analytics', { params });
