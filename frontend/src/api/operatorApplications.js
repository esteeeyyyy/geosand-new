import api from './axios';

export const submitOperatorApplication = (data) => {
  const fd = new FormData();
  fd.append('applicant_name', data.applicant_name);
  // Keep the existing backend/admin record compatible after removing the
  // separate quarry business name field from the public application form.
  fd.append('company_name', data.applicant_name);
  fd.append('email', data.email);
  fd.append('phone', data.phone);
  fd.append('quarry_location', data.quarry_location);
  if (data.permit_number) fd.append('permit_number', data.permit_number);
  if (data.remarks)       fd.append('remarks', data.remarks);
  if (data.document)      fd.append('document', data.document);

  return api.post('/apply-operator', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// Admin
export const getOperatorApplications = (params) => api.get('/admin/operator-applications', { params });
export const getOperatorApplication = (id) => api.get(`/admin/operator-applications/${id}`);
export const approveOperatorApplication = (id, data) => api.post(`/admin/operator-applications/${id}/approve`, data);
export const rejectOperatorApplication = (id, data) => api.post(`/admin/operator-applications/${id}/reject`, data);
