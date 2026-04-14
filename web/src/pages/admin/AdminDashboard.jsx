import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
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
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gray-50">{icon}</div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
};

const CHART_COLORS = ['#1B4332', '#2D6A4F', '#40916C', '#74C69D', '#B7E4C7'];

const PERIOD_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
];

export default function AdminDashboard() {
  const [dashData, setDashData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState(7);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.getDashboard(),
      adminAPI.getAnalytics(period),
    ])
      .then(([dash, ana]) => {
        setDashData(dash.data.data);
        setAnalytics(ana.data.data);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [period]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const timeSeries = analytics?.timeSeries || [];
  const summary = analytics?.summary || {};

  const pieData = [
    { name: 'Completed', value: dashData?.orders?.completed || 0 },
    { name: 'Active', value: dashData?.orders?.active || 0 },
    { name: 'Cancelled', value: (dashData?.orders?.total || 0) - (dashData?.orders?.completed || 0) - (dashData?.orders?.active || 0) },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">የአስተዳዳሪ ዳሽቦርድ • Fetno Ethiopia</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                period === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ethiopian Flag Banner */}
      <div className="h-1.5 rounded-full bg-gradient-to-r from-ethiopia-green via-ethiopia-yellow to-ethiopia-red" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Drivers" value={dashData?.drivers?.total || 0}
          subtitle={`${dashData?.drivers?.online || 0} online now`} icon="🚗" color="text-primary-700" to="/admin/drivers" />
        <StatCard title="Pending Approval" value={dashData?.drivers?.pending || 0}
          subtitle="Need review" icon="⏳" color="text-yellow-600" to="/admin/drivers" />
        <StatCard title="Total Stores" value={dashData?.stores?.total || 0}
          subtitle="Active partners" icon="🏪" color="text-blue-600" to="/admin/stores" />
        <StatCard title="Total Revenue"
          value={`ETB ${(summary.totalRevenue || 0).toLocaleString('en-ET', { maximumFractionDigits: 0 })}`}
          subtitle={`Today: ETB ${(dashData?.revenue?.today || 0).toFixed(0)}`}
          icon="💰" color="text-green-600" />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Orders" value={dashData?.orders?.total || 0} icon="📦" color="text-gray-900" to="/admin/orders" />
        <StatCard title="Active Deliveries" value={dashData?.orders?.active || 0} icon="🚚" color="text-blue-600" />
        <StatCard title="Completed" value={dashData?.orders?.completed || 0} icon="✅" color="text-green-600" />
      </div>

      {/* Charts Row 1 — Orders over time */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Orders & Revenue — Last {period} days</h2>
            {timeSeries.some((d) => d.orders > 0) && (
              <span className="text-xs text-gray-400">Live data</span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="orders" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value, name) =>
                  name === 'Revenue' ? `ETB ${value.toLocaleString()}` : value
                }
              />
              <Area yAxisId="orders" type="monotone" dataKey="orders"
                stroke="#1B4332" fill="#E8F5E9" strokeWidth={2} name="Orders" />
              <Area yAxisId="revenue" type="monotone" dataKey="revenue"
                stroke="#74C69D" fill="transparent" strokeWidth={2} strokeDasharray="5 3" name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">Order Distribution</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 — New Drivers bar chart */}
      <div className="card">
        <h2 className="font-bold text-gray-900 mb-4">New Driver Registrations — Last {period} days</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={timeSeries} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="newDrivers" fill="#40916C" radius={[4, 4, 0, 0]} name="New Drivers" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Review Drivers', am: 'ሾፌሮችን ይፈትሹ', icon: '🔍', to: '/admin/drivers', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
            { label: 'View All Orders', am: 'ሁሉም ትዕዛዞች', icon: '📦', to: '/admin/orders', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { label: 'Manage Stores', am: 'መደብሮችን አስተዳድሩ', icon: '🏪', to: '/admin/stores', color: 'bg-green-50 border-green-200 text-green-800' },
            { label: 'Surge Pricing', am: 'ዋጋ ማስፈጸሚያ', icon: '🔥', to: '/admin/surge', color: 'bg-orange-50 border-orange-200 text-orange-800' },
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
