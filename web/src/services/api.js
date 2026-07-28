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
  requestOtp: (phone, purpose) => api.post('/auth/otp/request', { phone, purpose }),
  verifyOtpRegister: (phone, code) => api.post('/auth/otp/verify-register', { phone, code }),
  completeRegistration: (data) => api.post('/auth/register/complete', data),
};

export const driverAPI = {
  list: () => api.get('/drivers'),
  create: (data) => api.post('/drivers', data),
};

export const storeAPI = {
  register: (data) => api.post('/store/register', data),
  getDashboard: () => api.get('/store/dashboard'),
  getProfile: () => api.get('/store/profile'),
  updateProfile: (data) => api.patch('/store/profile', data),
};

export const orderAPI = {
  create: (data) => api.post('/orders', data),
  estimate: (data) => api.post('/orders/estimate', data),
  getMyOrders: (params) => api.get('/orders', { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAnalytics: (period) => api.get('/admin/analytics', { params: { period } }),
  getDrivers: (params) => api.get('/admin/drivers', { params }),
  approveDriver: (driverId, action) => api.post(`/admin/drivers/${driverId}/action`, { action }),
  getDriverEarnings: (params) => api.get('/admin/drivers/earnings', { params }),
  getAllOrders: (params) => api.get('/admin/orders', { params }),
  getStores: (params) => api.get('/admin/stores', { params }),
  updateStoreStatus: (storeId, action) => api.patch(`/admin/stores/${storeId}/status`, { action }),
  getCustomers: (params) => api.get('/admin/customers', { params }),
  blockCustomer: (id, reason) => api.patch(`/admin/customers/${id}/block`, { reason }),
  unblockCustomer: (id) => api.patch(`/admin/customers/${id}/unblock`),
  getPromoCodes: (params) => api.get('/admin/promo-codes', { params }),
  createPromoCode: (data) => api.post('/admin/promo-codes', data),
  deactivatePromoCode: (id) => api.patch(`/admin/promo-codes/${id}/deactivate`),
  getSurge: () => api.get('/admin/surge'),
  setSurge: (city, multiplier) => api.post('/admin/surge', { city, multiplier }),
  getFinancialReport: (period) => api.get('/admin/financial-reports', { params: { period } }),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  getFraudFlags: (params) => api.get('/admin/fraud-flags', { params }),
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
