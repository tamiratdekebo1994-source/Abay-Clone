import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
  getAnalytics: (period = '7d') => api.get('/admin/analytics', { params: { period } }),
  getDrivers: (params) => api.get('/admin/drivers', { params }),
  approveDriver: (id, action) => api.patch(`/admin/drivers/${id}/status`, { action }),
  getStores: (params) => api.get('/admin/stores', { params }),
  getAllOrders: (params) => api.get('/admin/orders', { params }),
  getSurge: () => api.get('/admin/surge'),
  setSurge: (city, multiplier) => api.post('/admin/surge', { city, multiplier }),
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
