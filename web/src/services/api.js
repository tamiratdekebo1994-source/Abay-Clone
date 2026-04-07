import axios from 'axios';

// VITE_API_BASE_URL is set to the backend origin (e.g. https://api.abaydriver.et)
// when the web app is hosted separately (Firebase Hosting).
// When served from the same origin as the backend (nginx/VPS), leave it unset
// and the vite dev proxy / nginx will handle /api forwarding.
const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || '';

export const SOCKET_URL = API_ORIGIN || '/';

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
};

export const storeAPI = {
  register: (data) => api.post('/store/register', data),
  getProfile: () => api.get('/store/profile'),
  updateProfile: (data) => api.patch('/store/profile', data),
  getDashboard: () => api.get('/store/dashboard'),
};

export const orderAPI = {
  estimate: (data) => api.post('/orders/estimate', data),
  create: (data) => api.post('/orders', data),
  getMyOrders: (params) => api.get('/orders', { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
  cancel: (id, reason) => api.post(`/orders/${id}/cancel`, { reason }),
  review: (id, data) => api.post(`/orders/${id}/review`, data),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAnalytics: (days = 7) => api.get('/admin/analytics', { params: { days } }),
  getDrivers: (params) => api.get('/admin/drivers', { params }),
  approveDriver: (id, action) => api.patch(`/admin/drivers/${id}/status`, { action }),
  getStores: (params) => api.get('/admin/stores', { params }),
  updateStoreStatus: (id, action) => api.patch(`/admin/stores/${id}/status`, { action }),
  getAllOrders: (params) => api.get('/admin/orders', { params }),
  getSurge: () => api.get('/admin/surge'),
  setSurge: (city, multiplier) => api.post('/admin/surge', { city, multiplier }),
};

/**
 * Download an authenticated CSV export from the admin API.
 * Falls back to window.open for browsers that block programmatic downloads.
 * @param {string} path  e.g. '/admin/export/orders.csv'
 * @param {string} filename  suggested download filename
 */
export async function downloadCSV(path, filename) {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`/api${path}`, {
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

export default api;
