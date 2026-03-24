import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { storeAPI } from '../../services/api';

const StatCard = ({ title, titleAm, value, subtitle, icon, color }) => (
  <div className="card">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xs text-gray-400">{titleAm}</p>
        <p className={`text-3xl font-black mt-2 ${color || 'text-gray-900'}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className="text-3xl">{icon}</div>
    </div>
  </div>
);

const ORDER_STATUS = {
  PENDING: { label: 'Pending', class: 'badge-gray' },
  SEARCHING_DRIVER: { label: 'Finding Driver', class: 'badge-yellow' },
  DRIVER_ASSIGNED: { label: 'Driver Assigned', class: 'badge-blue' },
  DRIVER_AT_STORE: { label: 'Driver at Store', class: 'badge-blue' },
  PICKED_UP: { label: 'Picked Up', class: 'badge-blue' },
  IN_TRANSIT: { label: 'In Transit', class: 'badge-blue' },
  DELIVERED: { label: 'Delivered', class: 'badge-green' },
  CANCELLED: { label: 'Cancelled', class: 'badge-red' },
};

export default function StoreDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    storeAPI.getDashboard()
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Store Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">የእኔ መደብር ዳሽቦርድ</p>
        </div>
        <Link to="/store/orders/new" className="btn-primary flex items-center gap-2">
          <span>➕</span>
          <span>New Delivery</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Orders" titleAm="ዛሬ ትዕዛዞች"
          value={data?.stats?.todayOrders ?? 0}
          icon="📦" color="text-primary-600"
        />
        <StatCard
          title="Active Deliveries" titleAm="ንቁ ማድረሶች"
          value={data?.stats?.activeOrders ?? 0}
          icon="🚚" color="text-blue-600"
        />
        <StatCard
          title="Completed" titleAm="የተጠናቀቁ"
          value={data?.stats?.completedOrders ?? 0}
          icon="✅" color="text-green-600"
        />
        <StatCard
          title="Total Spent" titleAm="ጠቅላላ ወጪ"
          value={`ETB ${(data?.stats?.totalSpent ?? 0).toFixed(0)}`}
          icon="💰" color="text-accent-dark"
        />
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Recent Orders / የቅርብ ትዕዛዞች</h2>
          <Link to="/store/orders" className="text-sm text-primary-600 hover:underline">View all →</Link>
        </div>

        {data?.recentOrders?.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>No orders yet. Create your first delivery!</p>
            <p className="text-sm mt-1">ምንም ትዕዛዝ የለም። የመጀመሪያ ማድረስዎን ይፍጠሩ!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase border-b">
                  <th className="pb-3 pr-4">Order</th>
                  <th className="pb-3 pr-4">Delivery Address</th>
                  <th className="pb-3 pr-4">Driver</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.recentOrders?.map((order) => {
                  const status = ORDER_STATUS[order.status] || { label: order.status, class: 'badge-gray' };
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-sm text-primary-700">#{order.orderNumber}</div>
                        <div className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('en-ET')}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-sm text-gray-700 max-w-xs truncate">{order.deliveryAddress}</div>
                        <div className="text-xs text-gray-400">{order.recipientName}</div>
                      </td>
                      <td className="py-3 pr-4">
                        {order.driver ? (
                          <div>
                            <div className="text-sm font-medium">{order.driver.user?.fullName}</div>
                            <div className="text-xs text-gray-400">{order.driver.vehiclePlate}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-sm font-bold text-gray-900">ETB {order.totalAmount?.toFixed(2)}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={status.class}>{status.label}</span>
                      </td>
                      <td className="py-3">
                        {['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'].includes(order.status) && (
                          <Link
                            to={`/store/orders/${order.id}/track`}
                            className="text-xs text-primary-600 hover:underline font-medium"
                          >
                            Track →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: 'Place Delivery', titleAm: 'ማድረስ ልዑካን', icon: '🚀', to: '/store/orders/new', color: 'bg-primary-600' },
          { title: 'Order History', titleAm: 'የትዕዛዝ ታሪክ', icon: '📋', to: '/store/orders', color: 'bg-blue-600' },
          { title: 'Get Help', titleAm: 'እርዳታ ያግኙ', icon: '💬', to: '#', color: 'bg-gray-600' },
        ].map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className={`${action.color} text-white rounded-xl p-5 flex items-center gap-4 hover:opacity-90 transition-opacity`}
          >
            <span className="text-3xl">{action.icon}</span>
            <div>
              <div className="font-bold">{action.title}</div>
              <div className="text-sm opacity-80">{action.titleAm}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
