import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', class: 'badge-yellow' },
  APPROVED: { label: 'Approved', class: 'badge-green' },
  OFFLINE: { label: 'Offline', class: 'badge-gray' },
  ONLINE: { label: 'Online', class: 'badge-green' },
  BUSY: { label: 'Busy', class: 'badge-blue' },
  SUSPENDED: { label: 'Suspended', class: 'badge-red' },
};

const VEHICLE_ICONS = { MOTORCYCLE: '🏍️', BAJAJ: '🛺', CAR: '🚗', VAN: '🚐', TRUCK: '🚚' };

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => {
    loadDrivers();
  }, [statusFilter, page]);

  const loadDrivers = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getDrivers({ status: statusFilter || undefined, page, limit: 15 });
      setDrivers(data.data.drivers);
      setTotal(data.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (driverId, action) => {
    setActionLoading(driverId);
    try {
      await adminAPI.approveDriver(driverId, action);
      loadDrivers();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Drivers Management</h1>
        <p className="text-gray-500 text-sm mt-1">የሾፌሮች አስተዳደር • {total} total</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {['', 'PENDING', 'ONLINE', 'OFFLINE', 'SUSPENDED'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === '' ? 'All Drivers' : STATUS_CONFIG[s]?.label || s}
              {s === 'PENDING' && <span className="ml-1.5 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5">!</span>}
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
        ) : drivers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🚗</div>
            <p>No drivers found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">License</th>
                <th className="px-6 py-4">Stats</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.map((driver) => {
                const status = STATUS_CONFIG[driver.status] || { label: driver.status, class: 'badge-gray' };
                return (
                  <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center font-bold text-primary-700 flex-shrink-0">
                          {driver.user?.fullName?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{driver.user?.fullName}</div>
                          <div className="text-xs text-gray-400">{driver.user?.phone}</div>
                          <div className="text-xs text-gray-400">{driver.city}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <span className="mr-1">{VEHICLE_ICONS[driver.vehicleType] || '🚗'}</span>
                        {driver.vehicleModel}
                      </div>
                      <div className="text-xs text-gray-400">{driver.vehiclePlate} • {driver.vehicleColor}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono">{driver.licenseNumber}</div>
                      <div className="text-xs text-gray-400">
                        Exp: {new Date(driver.licenseExpiry).toLocaleDateString('en-ET')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">⭐ {driver.rating?.toFixed(1)}</div>
                      <div className="text-xs text-gray-400">{driver.totalDeliveries} trips</div>
                      <div className="text-xs text-gray-400">ETB {driver.totalEarnings?.toFixed(0)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={status.class}>{status.label}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {driver.status === 'PENDING' && (
                          <button
                            onClick={() => handleAction(driver.id, 'approve')}
                            disabled={actionLoading === driver.id}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            ✓ Approve
                          </button>
                        )}
                        {['OFFLINE', 'ONLINE', 'PENDING'].includes(driver.status) && (
                          <button
                            onClick={() => handleAction(driver.id, 'suspend')}
                            disabled={actionLoading === driver.id}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                        {driver.status === 'SUSPENDED' && (
                          <button
                            onClick={() => handleAction(driver.id, 'approve')}
                            disabled={actionLoading === driver.id}
                            className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            Reinstate
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
      </div>
    </div>
  );
}
