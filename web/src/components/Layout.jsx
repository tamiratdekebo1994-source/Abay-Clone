import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authSlice';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../services/api';

const storeNav = [
  { to: '/store', label: 'Dashboard', icon: '📊', end: true },
  { to: '/store/orders', label: 'My Orders', icon: '📦' },
  { to: '/store/orders/new', label: 'New Delivery', icon: '➕' },
  { to: '/store/profile', label: 'Store Profile', icon: '🏪' },
];

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/drivers', label: 'Drivers', icon: '🚗' },
  { to: '/admin/stores', label: 'Stores', icon: '🏪' },
  { to: '/admin/orders', label: 'All Orders', icon: '📦' },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: '💸' },
  { to: '/admin/surge', label: 'Surge Pricing', icon: '🔥' },
];

export default function Layout() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orderAlert, setOrderAlert] = useState(null); // { orderId, orderNumber, status }
  const socketRef = useRef(null);

  // Real-time order alerts for store users
  useEffect(() => {
    if (user?.role !== 'STORE') return;
    const token = localStorage.getItem('accessToken');
    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on('order_status_updated', (data) => {
      setOrderAlert({ ...data, ts: Date.now() });
      // Browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('Fetno — Order Update', {
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
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-primary-600 text-white flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Logo */}
        <div className="flex items-center p-4 border-b border-primary-500">
          <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-primary-800 font-bold text-xs">Fetno</span>
          </div>
          {sidebarOpen && (
            <div className="ml-3">
              <div className="font-bold text-lg leading-none">Fetno</div>
              <div className="text-primary-300 text-xs mt-0.5">
                {user?.role === 'ADMIN' ? 'Admin Portal' : 'Store Portal'}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white text-primary-700 font-semibold'
                    : 'text-primary-100 hover:bg-primary-500'
                }`
              }
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-primary-500">
          {sidebarOpen && (
            <div className="mb-2 px-3">
              <div className="text-sm font-semibold truncate">{user?.fullName}</div>
              <div className="text-xs text-primary-300">{user?.phone}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-primary-100 hover:bg-primary-500 rounded-lg transition-colors"
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
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user?.fullName?.charAt(0)}
            </div>
          </div>
        </header>

        {/* Real-time order alert banner */}
        {orderAlert && (
          <div className="bg-primary-600 text-white px-6 py-3 flex items-center justify-between text-sm animate-pulse-once flex-shrink-0">
            <span>
              📦 <strong>Order #{orderAlert.orderNumber}</strong> — {orderAlert.status?.replace(/_/g, ' ')}
            </span>
            <div className="flex items-center gap-3">
              <Link
                to={`/store/orders/${orderAlert.orderId}/track`}
                className="bg-white text-primary-700 font-semibold px-3 py-1 rounded-lg text-xs hover:bg-primary-50"
              >
                Track →
              </Link>
              <button onClick={() => setOrderAlert(null)} className="text-primary-200 hover:text-white text-lg leading-none">×</button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
