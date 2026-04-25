import axios from 'axios';
import { Platform } from 'react-native';
import { API_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Firebase ID token to every request — Firebase handles refresh automatically
api.interceptors.request.use(
  async (config) => {
    try {
      const { auth } = await import('./firebase');
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {}
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

// Auth
export const authAPI = {
  // OTP flows
  requestOtp: (phone, purpose) => api.post('/auth/otp/request', { phone, purpose }),
  verifyOtpLogin: (phone, code) => api.post('/auth/otp/verify-login', { phone, code }),
  verifyOtpRegister: (phone, code) => api.post('/auth/otp/verify-register', { phone, code }),
  completeRegistration: (data) => api.post('/auth/register/complete', data),
  // Legacy password (admin)
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/profile', data),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
};

// Driver
export const driverAPI = {
  register: (data) => api.post('/driver/register', data),
  getProfile: () => api.get('/driver/profile'),
  updateLocation: (lat, lng) => api.patch('/driver/location', { lat, lng }),
  toggleOnline: () => api.post('/driver/toggle-online'),
  getNearbyOrders: (lat, lng, radius = 10) =>
    api.get('/driver/orders/nearby', { params: { lat, lng, radius } }),
  getEarnings: (period) => api.get('/driver/earnings', { params: { period } }),
  registerPushToken: (token) => api.post('/driver/push-token', { token, platform: Platform.OS }),
  getSurge: (city) => api.get('/driver/surge', { params: { city } }),
};

// Orders
export const orderAPI = {
  getMyOrders: (params) => api.get('/orders', { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
  acceptOrder: (id) => api.post(`/orders/${id}/accept`),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  cancelOrder: (id, reason) => api.post(`/orders/${id}/cancel`, { reason }),
  submitReview: (id, data) => api.post(`/orders/${id}/review`, data),
};

// Chat
export const chatAPI = {
  getMessages: (orderId) => api.get(`/chat/order/${orderId}`),
  sendMessage: (orderId, message) => api.post(`/chat/order/${orderId}`, { message }),
  getUnreadCount: () => api.get('/chat/unread'),
};

// Notifications
export const notificationAPI = {
  list: (params) => api.get('/notifications', { params }),
  markAllRead: () => api.patch('/notifications/read-all'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

// Uploads
export const uploadAPI = {
  cargoPhoto: (orderId, uri) => {
    const formData = new FormData();
    formData.append('file', { uri, type: 'image/jpeg', name: 'cargo.jpg' });
    return api.post(`/upload/order/${orderId}/cargo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
  },
};

// Payments
export const paymentAPI = {
  initiateTelebirr: (orderId) => api.post('/payments/telebirr/initiate', { orderId }),
  initiateCBE: (orderId) => api.post('/payments/cbe/initiate', { orderId }),
  checkStatus: (paymentRef) => api.get(`/payments/status/${paymentRef}`),
};

export default api;
