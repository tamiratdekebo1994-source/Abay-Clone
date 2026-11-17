import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authSlice';
import { io } from 'socket.io-client';
import { SOCKET_URL, getAuthToken } from '../services/api';
import ErrorBoundary from './ErrorBoundary';

const storeNav = [
  { to: '/store', label: 'Dashboard', icon: '📊', end: true },
  { to: '/store/orders', label: 'My Orders', icon: '📦' },
  { to: '/store/orders/new', label: 'New Delivery', icon: '➕' },
  { to: '/store/profile', label: 'Store Profile', icon: '🏪' },
];

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/drivers', label: 'Drivers', icon: '🚗' },
  { to: '/admin/drivers/earnings', label: 'Driver Earnings', icon: '💰' },
  { to: '/admin/stores', label: 'Stores', icon: '🏪' },
  { to: '/admin/orders', label: 'All Orders', icon: '📦' },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: '💸' },
  { to: '/admin/reports/financial', label: 'Financial Reports', icon: '📈' },
  { to: '/admin/surge', label: 'Surge Pricing', icon: '🔥' },
  { to: '/admin/customers', label: 'Customers', icon: '👥' },
  { to: '/admin/promo-codes', label: 'Promo Codes', icon: '🎁' },
  { to: '/admin/fraud', label: 'Fraud Detection', icon: '⚠️' },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: '📋' },
  { to: '/admin/settings', label: 'Commission Settings', icon: '⚙️' },
];

export default function Layout() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orderAlert, setOrderAlert] = useState(null); // { orderId, orderNumber, status }
  const socketRef = useRef(null);

  // Real-time order alerts for store users
  useEffect(() => {
    if (user?.role !== 'STORE') return;
    // Function form, so reconnects send a fresh Firebase token instead of an expired one.
    const socket = io(SOCKET_URL, { auth: async (cb) => cb({ token: await getAuthToken() }) });

    socket.on('order_status_updated', (data) => {
      setOrderAlert({ ...data, ts: Date.now() });
      // Browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('ET SPARK — Order Update', {
          body: `Order #${data.orderNumber}: ${data.status?.replace(/_/g, ' ')}`,
          icon: '/favicon.svg',
        });
      }
    });

    socket.on('driver_assigned', (data) => {
      setOrderAlert({ ...data, ts: Date.now() });
      if (Notification.permission === 'granted') {
        new Notification('🚗 Driver Assigned!', {
          body: `A driver has been assigned to order #${data.orderNumber}`,
          icon: '/favicon.svg',
        });
      }
    });

    socketRef.current = socket;

    // Request browser notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => socket.disconnect();
  }, [user]);

  // Auto-dismiss alert after 6 seconds
  useEffect(() => {
    if (!orderAlert) return;
    const timer = setTimeout(() => setOrderAlert(null), 6000);
    return () => clearTimeout(timer);
  }, [orderAlert?.ts]);

  const navItems = user?.role === 'ADMIN' ? adminNav : storeNav;

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-accent text-primary flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Logo */}
        <div className="flex items-center p-4 border-b border-primary/20">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-700 text-accent rounded-lg flex items-center justify-center flex-shrink-0 text-lg font-bold">
            ⚡
          </div>
          {sidebarOpen && (
            <div className="ml-3">
              <div className="font-black text-base leading-none">ET SPARK</div>
              <div className="text-primary/70 text-xs mt-0.5">
                {user?.role === 'ADMIN' ? 'Admin Dashboard' : 'Store Dashboard'}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-accent font-semibold'
                    : 'text-primary hover:bg-primary/10'
                }`
              }
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-primary/20">
          {sidebarOpen && (
            <div className="mb-2 px-3">
              <div className="text-sm font-semibold truncate">{user?.fullName}</div>
              <div className="text-xs text-primary/70">{user?.phone}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <span className="text-xl flex-shrink-0">🚪</span>
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">🇪🇹 Ethiopia</span>
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-primary font-bold text-sm">
              {user?.fullName?.charAt(0)}
            </div>
          </div>
        </header>

        {/* Real-time order alert banner */}
        {orderAlert && (
          <div className="bg-accent text-primary px-6 py-3 flex items-center justify-between text-sm animate-pulse-once flex-shrink-0">
            <span>
              📦 <strong>Order #{orderAlert.orderNumber}</strong> — {orderAlert.status?.replace(/_/g, ' ')}
            </span>
            <div className="flex items-center gap-3">
              <Link
                to={`/store/orders/${orderAlert.orderId}/track`}
                className="bg-primary text-accent font-semibold px-3 py-1 rounded-lg text-xs hover:bg-primary-700"
              >
                Track →
              </Link>
              <button onClick={() => setOrderAlert(null)} className="text-primary/60 hover:text-primary text-lg leading-none">×</button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
