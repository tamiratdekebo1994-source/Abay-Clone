import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function AdminStores() {
  const [stores, setStores] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => { loadStores(); }, [page]);

  const loadStores = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getStores({ page, limit: 15 });
      setStores(data.data.stores);
      setTotal(data.data.total);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Stores Management</h1>
        <p className="text-gray-500 text-sm mt-1">የመደብሮች አስተዳደር • {total} total</p>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🏪</div>
            <p>No stores registered yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-6 py-4">Store</th>
                <th className="px-6 py-4">Owner</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4">Verified</th>
                <th className="px-6 py-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">🏪</div>
                      <div>
                        <div className="font-semibold text-sm">{store.storeName}</div>
                        <div className="text-xs text-gray-400">{store.storeType}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{store.user?.fullName}</div>
                    <div className="text-xs text-gray-400">{store.user?.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{store.city}</div>
                    <div className="text-xs text-gray-400 max-w-xs truncate">{store.address}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm">{store._count?.orders || store.totalOrders || 0}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">⭐ {store.rating?.toFixed(1) || '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    {store.isVerified
                      ? <span className="badge-green">✓ Verified</span>
                      : <span className="badge-gray">Pending</span>
                    }
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-gray-500">
                      {new Date(store.createdAt).toLocaleDateString('en-ET', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
