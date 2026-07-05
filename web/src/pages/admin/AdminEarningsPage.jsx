import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function AdminEarningsPage() {
  const [drivers, setDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('earnings');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalUnpaid, setTotalUnpaid] = useState(0);

  useEffect(() => {
    loadEarnings();
  }, [sortBy, page]);

  const loadEarnings = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getDriverEarnings({ sortBy, page, limit: 30 });
      setDrivers(data.drivers);
      setTotal(data.total);
      setTotalUnpaid(data.totalUnpaidEarnings);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Driver Earnings</h1>
          <p className="text-gray-500 text-sm mt-1">Track driver payments & unpaid earnings</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Total Unpaid</div>
          <div className="text-3xl font-black text-red-600">ETB {totalUnpaid.toLocaleString('en-ET', { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="card p-4 flex gap-2">
        {[
          { label: 'Top Earners', value: 'earnings' },
          { label: 'Highest Rated', value: 'rating' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setSortBy(opt.value); setPage(1); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              sortBy === opt.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No drivers yet</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Total Earned</th>
                <th className="px-6 py-4">Unpaid Amount</th>
                <th className="px-6 py-4">Unpaid Orders</th>
                <th className="px-6 py-4">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-sm">{driver.user?.fullName}</div>
                    <div className="text-xs text-gray-400">{driver.user?.phone}</div>
                    <div className="text-xs text-gray-400">{driver.city}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold">ETB {driver.totalEarnings?.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-red-600">ETB {driver.unpaidAmount?.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{driver.unpaidOrders}</td>
                  <td className="px-6 py-4 text-sm">⭐ {driver.rating?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 30 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {Math.min((page - 1) * 30 + 1, total)}–{Math.min(page * 30, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-600 flex items-center px-3">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(total / 30), p + 1))}
              disabled={page >= Math.ceil(total / 30)}
              className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
