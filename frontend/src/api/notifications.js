import api from './axios';

export const getNotifications = (params) => api.get('/notifications', { params });
export const getUnreadCount = () => api.get('/notifications/unread');
export const markAsRead = (id = null) => api.post('/notifications/read', { id });
export const markAllAsRead = () => api.post('/notifications/read');
