import api from './axios';

export const getAuditLogs = (params) => api.get('/admin/audit-logs', { params });
export const getAuditFilters = () => api.get('/admin/audit-logs/filters');
