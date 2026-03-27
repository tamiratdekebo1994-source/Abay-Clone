import React, { useState, useEffect } from 'react';
import { adminAPI, downloadCSV } from '../../services/api';

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', class: 'badge-gray' },
  SEARCHING_DRIVER: { label: 'Finding Driver', class: 'badge-yellow' },
  DRIVER_ASSIGNED: { label: 'Assigned', class: 'badge-blue' },
  DRIVER_AT_STORE: { label: 'At Store', class: 'badge-blue' },
  PICKED_UP: { label: 'Picked Up', class: 'badge-blue' },
  IN_TRANSIT: { label: 'In Transit', class: 'badge-blue' },
  DELIVERED: { label: 'Delivered', class: 'badge-green' },
  CANCELLED: { label: 'Cancelled', class: 'badge-red' },
  FAILED: { label: 'Failed', class: 'badge-red' },
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => { loadOrders(); }, [statusFilter, page]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadCSV('/admin/export/orders.csv', `orders_${Date.now()}.csv`);
    } catch (err) { console.error(err); }
    finally { setIsExporting(false); }
  };

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getAllOrders({ status: statusFilter || undefined, page, limit: 15 });
      setOrders(data.data.orders);
      setTotal(data.data.total);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">All Orders</h1>
          <p className="text-gray-500 text-sm mt-1">ሁሉም ትዕዛዞች • {total} total</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isExporting ? '...' : '⬇ Export CSV'}
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {['', 'SEARCHING_DRIVER', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === '' ? 'All' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-4">📦</div><p>No orders found</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-6 py-4">Order</th>
                <th className="px-6 py-4">Store</th>
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Route</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const status = STATUS_CONFIG[order.status] || { label: order.status, class: 'badge-gray' };
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-primary-700">#{order.orderNumber}</div>
                      <div className="text-xs text-gray-400">{order.distanceKm?.toFixed(1)} km</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium">{order.store?.storeName}</div>
                      <div className="text-xs text-gray-400">{order.store?.city}</div>
                    </td>
                    <td className="px-6 py-4">
                      {order.driver ? (
                        <div>
                          <div className="text-sm">{order.driver.user?.fullName}</div>
                          <div className="text-xs text-gray-400">{order.driver.vehiclePlate}</div>
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-500 max-w-xs truncate">→ {order.deliveryAddress}</div>
                      <div className="text-xs text-gray-400">{order.recipientName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold">ETB {order.totalAmount?.toFixed(2)}</div>
                      <div className="text-xs text-gray-400">Fee: ETB {order.platformFee?.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4"><span className={status.class}>{status.label}</span></td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('en-ET', { day: 'numeric', month: 'short' })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {Math.min((page - 1) * 15 + 1, total)}–{Math.min(page * 15, total)} of {total} orders
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
                {page} / {Math.ceil(total / 15)}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(Math.ceil(total / 15), p + 1))}
                disabled={page >= Math.ceil(total / 15)}
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
