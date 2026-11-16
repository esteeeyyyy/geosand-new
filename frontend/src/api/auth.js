import api from './axios';

export const login = (email, password) => api.post('/login', { email, password });
export const googleLogin = (credential) => api.post('/auth/google', { credential });
export const getMe = () => api.get('/me');
export const logout = () => api.post('/logout');
