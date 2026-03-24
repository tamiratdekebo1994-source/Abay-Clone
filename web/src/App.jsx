import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { loadUser } from './store/authSlice';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StoreDashboard from './pages/store/StoreDashboard';
import CreateOrder from './pages/store/CreateOrder';
import StoreOrders from './pages/store/StoreOrders';
import OrderTracking from './pages/store/OrderTracking';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDrivers from './pages/admin/AdminDrivers';
import AdminStores from './pages/admin/AdminStores';
import AdminOrders from './pages/admin/AdminOrders';
import AdminWithdrawals from './pages/admin/AdminWithdrawals';
import AdminSurge from './pages/admin/AdminSurge';
import StoreProfile from './pages/store/StoreProfile';
import Layout from './components/Layout';

function PrivateRoute({ children, roles }) {
  const { isAuthenticated, user, isLoading } = useSelector((s) => s.auth);
  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  useEffect(() => {
    dispatch(loadUser());
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Store Routes */}
      <Route path="/store" element={<PrivateRoute roles={['STORE']}><Layout /></PrivateRoute>}>
        <Route index element={<StoreDashboard />} />
        <Route path="orders" element={<StoreOrders />} />
        <Route path="orders/new" element={<CreateOrder />} />
        <Route path="orders/:orderId/track" element={<OrderTracking />} />
        <Route path="profile" element={<StoreProfile />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<PrivateRoute roles={['ADMIN']}><Layout /></PrivateRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="drivers" element={<AdminDrivers />} />
        <Route path="stores" element={<AdminStores />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="surge" element={<AdminSurge />} />
      </Route>

      {/* Default redirect based on role */}
      <Route path="/" element={
        <PrivateRoute>
          {user?.role === 'ADMIN' ? <Navigate to="/admin" replace /> :
           user?.role === 'STORE' ? <Navigate to="/store" replace /> :
           <Navigate to="/login" replace />}
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
