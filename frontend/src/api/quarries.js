import api from './axios';

export const getQuarries = (params) => api.get('/quarries', { params });
export const getQuarry = (id) => api.get(`/quarries/${id}`);
export const getQuarryGisFile = (id) => api.get(`/quarries/${id}/gis-file`);
export const applyOperator = (data) => api.post('/apply-operator', data);

// Admin
export const createQuarry = (data) => api.post('/admin/quarries', data);
export const updateQuarry = (id, data) => api.put(`/admin/quarries/${id}`, data);
export const deleteQuarry = (id) => api.delete(`/admin/quarries/${id}`);

export const createQuarryPermit = (quarryId, data) => {
  const fd = new FormData();
  fd.append('permit_number', data.permit_number);
  fd.append('issued_at', data.issued_at);
  if (data.annual_allowable_volume_cubic_meters !== '') {
    fd.append('annual_allowable_volume_cubic_meters', data.annual_allowable_volume_cubic_meters);
  }
  if (data.document) fd.append('document', data.document);
  return api.post(`/admin/quarries/${quarryId}/permits`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const updateQuarryPermit = (quarryId, permitId, data) => api.put(
  `/admin/quarries/${quarryId}/permits/${permitId}`,
  data,
);

export const uploadGisFile = (id, file) => {
  const fd = new FormData();
  fd.append('gis_file', file);
  return api.post(`/admin/quarries/${id}/gis-file`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteGisFile = (id) => api.delete(`/admin/quarries/${id}/gis-file`);

// Operator
export const getMyQuarry = () => api.get('/operator/my-quarry');

// Staff
export const getStaffQuarry = () => api.get('/staff/my-quarry');

// AI Naive Bayes Terrain Analysis
export const getAiTerrainAnalysis = (id) => api.get(`/quarries/${id}/ai-terrain-analysis`);
export const analyzeGisElevation = (data) => {
  if (data instanceof FormData) {
    return api.post('/quarries/analyze-gis-elevation', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return api.post('/quarries/analyze-gis-elevation', data);
};

