import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { adminAPI } from '../../services/api';

const StatCard = ({ title, value, subtitle, icon, color, to }) => {
  const content = (
    <div className={`card hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-3xl font-black mt-2 ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gray-50`}>{icon}</div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
};

const COLORS = ['#1B4332', '#2D6A4F', '#40916C', '#74C69D', '#B7E4C7'];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminAPI.getDashboard()
      .then(({ data: res }) => setData(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const pieData = [
    { name: 'Completed', value: data?.orders?.completed || 0 },
    { name: 'Active', value: data?.orders?.active || 0 },
    { name: 'Today', value: data?.orders?.today || 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">የአስተዳዳሪ ዳሽቦርድ • Abay Driver Ethiopia</p>
      </div>

      {/* Ethiopian Flag Banner */}
      <div className="h-1.5 rounded-full bg-gradient-to-r from-ethiopia-green via-ethiopia-yellow to-ethiopia-red" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Drivers" value={data?.drivers?.total || 0}
          subtitle={`${data?.drivers?.online || 0} online now`} icon="🚗" color="text-primary-700" to="/admin/drivers" />
        <StatCard title="Pending Approval" value={data?.drivers?.pending || 0}
          subtitle="Need review" icon="⏳" color="text-yellow-600" to="/admin/drivers" />
        <StatCard title="Total Stores" value={data?.stores?.total || 0}
          subtitle="Active partners" icon="🏪" color="text-blue-600" to="/admin/stores" />
        <StatCard title="Today's Revenue" value={`ETB ${(data?.revenue?.today || 0).toFixed(0)}`}
          subtitle={`Total: ETB ${(data?.revenue?.total || 0).toFixed(0)}`} icon="💰" color="text-green-600" />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Orders" value={data?.orders?.total || 0} icon="📦" color="text-gray-900" to="/admin/orders" />
        <StatCard title="Active Deliveries" value={data?.orders?.active || 0} icon="🚚" color="text-blue-600" />
        <StatCard title="Completed" value={data?.orders?.completed || 0} icon="✅" color="text-green-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Placeholder chart - in real app this would use time-series data */}
        <div className="lg:col-span-2 card">
          <h2 className="font-bold text-gray-900 mb-4">Orders Overview</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={[
              { name: 'Mon', orders: 12, revenue: 1800 },
              { name: 'Tue', orders: 19, revenue: 2850 },
              { name: 'Wed', orders: 15, revenue: 2250 },
              { name: 'Thu', orders: 25, revenue: 3750 },
              { name: 'Fri', orders: 32, revenue: 4800 },
              { name: 'Sat', orders: 28, revenue: 4200 },
              { name: 'Sun', orders: data?.orders?.today || 0, revenue: (data?.revenue?.today || 0) },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="orders" stroke="#1B4332" fill="#E8F5E9" strokeWidth={2} name="Orders" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">Order Distribution</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Review Drivers', am: 'ሾፌሮችን ይፈትሹ', icon: '🔍', to: '/admin/drivers', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
            { label: 'View All Orders', am: 'ሁሉም ትዕዛዞች', icon: '📦', to: '/admin/orders', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { label: 'Manage Stores', am: 'መደብሮችን አስተዳድሩ', icon: '🏪', to: '/admin/stores', color: 'bg-green-50 border-green-200 text-green-800' },
            { label: 'Analytics', am: 'ትንታኔ', icon: '📊', to: '/admin', color: 'bg-purple-50 border-purple-200 text-purple-800' },
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={`${action.color} border rounded-xl p-4 flex flex-col items-center text-center hover:shadow-sm transition-shadow`}
            >
              <span className="text-3xl mb-2">{action.icon}</span>
              <span className="text-sm font-semibold">{action.label}</span>
              <span className="text-xs opacity-70 mt-0.5">{action.am}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
