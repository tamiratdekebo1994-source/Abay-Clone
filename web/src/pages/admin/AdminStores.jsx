import React, { useState, useEffect } from 'react';
import { adminAPI, downloadCSV } from '../../services/api';

export default function AdminStores() {
  const [stores, setStores] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

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

  const handleAction = async (storeId, action) => {
    setActionLoading(`${storeId}-${action}`);
    try {
      await adminAPI.updateStoreStatus(storeId, action);
      loadStores();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadCSV('/admin/export/stores.csv', `stores_${Date.now()}.csv`);
    } catch (err) { console.error(err); }
    finally { setIsExporting(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Stores Management</h1>
          <p className="text-gray-500 text-sm mt-1">የመደብሮች አስተዳደር • {total} total</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isExporting ? '...' : '⬇ Export Stores CSV'}
        </button>
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
                <th className="px-6 py-4">Actions</th>
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
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5 flex-wrap">
                      {!store.isVerified ? (
                        <button
                          onClick={() => handleAction(store.id, 'verify')}
                          disabled={actionLoading === `${store.id}-verify`}
                          className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          ✓ Verify
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(store.id, 'unverify')}
                          disabled={actionLoading === `${store.id}-unverify`}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          Unverify
                        </button>
                      )}
                      {store.user?.isActive !== false ? (
                        <button
                          onClick={() => handleAction(store.id, 'suspend')}
                          disabled={actionLoading === `${store.id}-suspend`}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(store.id, 'unsuspend')}
                          disabled={actionLoading === `${store.id}-unsuspend`}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          Reinstate
                        </button>
                      )}
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
