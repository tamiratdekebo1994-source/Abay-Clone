import axios from 'axios';

const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || 'https://europe-west1-abay-clone-project-36721.cloudfunctions.net/api';

export const SOCKET_URL = API_ORIGIN || '/';

// Use direct Cloud Function URL
const baseURL = API_ORIGIN;

console.log('API Base URL:', baseURL);

const api = axios.create({
  baseURL,
  timeout: 60000, // Increased timeout to 60 seconds
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userId');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/login', data),
  register: (data) => api.post('/register', data),
};

export const driverAPI = {
  list: () => api.get('/drivers'),
  create: (data) => api.post('/drivers', data),
};

export const storeAPI = {
  list: () => api.get('/stores'),
  create: (data) => api.post('/stores', data),
};

export const orderAPI = {
  create: (data) => api.post('/orders', data),
  list: () => api.get('/orders'),
  get: (id) => api.get(`/orders/${id}`),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getDrivers: () => api.get('/admin/drivers'),
  getCustomers: () => api.get('/admin/customers'),
  blockCustomer: (id, reason) => api.patch(`/admin/customers/${id}/block`, { reason }),
  getPromoCodes: () => api.get('/admin/promo-codes'),
  createPromoCode: (data) => api.post('/admin/promo-codes', data),
  getAuditLogs: () => api.get('/admin/audit-logs'),
  getFraudFlags: () => api.get('/admin/fraud-flags'),
  createFraudFlag: (data) => api.post('/admin/fraud-flags', data),
  resolveFraudFlag: (id, data) => api.patch(`/admin/fraud-flags/${id}/resolve`, data),
  getCommissionSettings: () => api.get('/admin/settings/commission'),
  updateCommissionSettings: (data) => api.patch('/admin/settings/commission', data),
};

export const chatAPI = {
  getMessages: (orderId) => api.get(`/chat/order/${orderId}`),
  sendMessage: (orderId, message) => api.post(`/chat/order/${orderId}`, { message }),
};

export const walletAPI = {
  getPendingWithdrawals: (status) => api.get('/wallet/pending', { params: { status } }),
  processWithdrawal: (id, data) => api.patch(`/wallet/${id}/process`, data),
};

export const notificationAPI = {
  list: (params) => api.get('/notifications', { params }),
  markAllRead: () => api.patch('/notifications/read-all'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

export async function downloadCSV(path, filename) {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API_ORIGIN}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default api;
