import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { orderAPI } from '../../services/api';

const FRONTEND_URL = window.location.origin;

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', class: 'badge-gray' },
  SEARCHING_DRIVER: { label: 'Finding Driver', class: 'badge-yellow' },
  DRIVER_ASSIGNED: { label: 'Driver Assigned', class: 'badge-blue' },
  DRIVER_AT_STORE: { label: 'At Pickup', class: 'badge-blue' },
  PICKED_UP: { label: 'Picked Up', class: 'badge-blue' },
  IN_TRANSIT: { label: 'In Transit', class: 'badge-blue' },
  DELIVERED: { label: 'Delivered', class: 'badge-green' },
  CANCELLED: { label: 'Cancelled', class: 'badge-red' },
  FAILED: { label: 'Failed', class: 'badge-red' },
};

export default function StoreOrders() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadOrders();
  }, [statusFilter, page]);

  const copyTrackingLink = (orderId) => {
    const url = `${FRONTEND_URL}/track/${orderId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(orderId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const { data } = await orderAPI.getMyOrders({ status: statusFilter || undefined, page, limit: 15 });
      setOrders(data.data.orders);
      setPagination(data.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">My Orders</h1>
          <p className="text-gray-500 text-sm mt-1">የእኔ ትዕዛዞች</p>
        </div>
        <Link to="/store/orders/new" className="btn-primary flex items-center gap-2">
          <span>➕</span> New Order
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {['', 'SEARCHING_DRIVER', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-accent text-primary'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === '' ? 'All Orders' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">📭</div>
            <p className="font-medium">No orders found</p>
            <p className="text-sm mt-1">ምንም ትዕዛዝ አልተገኘም</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-6 py-4">Order #</th>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Destination</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const status = STATUS_CONFIG[order.status] || { label: order.status, class: 'badge-gray' };
                const isActive = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'].includes(order.status);
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-primary-700 text-sm">#{order.orderNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium">{order.recipientName}</div>
                      <div className="text-xs text-gray-400">{order.recipientPhone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 max-w-xs truncate">{order.deliveryAddress}</div>
                      <div className="text-xs text-gray-400">{order.distanceKm?.toFixed(1)} km</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold">ETB {order.totalAmount?.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={status.class}>{status.label}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('en-ET', { day: 'numeric', month: 'short' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <Link to={`/store/orders/${order.id}/track`} className="text-xs text-primary-600 hover:underline font-semibold">
                            Track →
                          </Link>
                        )}
                        {(isActive || order.status === 'DELIVERED') && (
                          <button
                            onClick={() => copyTrackingLink(order.id)}
                            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                            title="Copy tracking link for customer"
                          >
                            {copiedId === order.id ? '✓ Copied' : '🔗'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {orders.length} of {pagination.total} orders
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-600 flex items-center px-3">
                {page} / {pagination.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
