import React, { useState, useEffect } from 'react';
import { adminAPI, downloadCSV } from '../../services/api';

const BACKEND_URL = import.meta.env.DEV ? 'http://localhost:5000' : '';

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
  const [docDriver, setDocDriver] = useState(null); // for document modal
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadCSV('/admin/export/drivers.csv', `drivers_${Date.now()}.csv`);
    } catch (err) { console.error(err); }
    finally { setIsExporting(false); }
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Drivers Management</h1>
          <p className="text-gray-500 text-sm mt-1">የሾፌሮች አስተዳደር • {total} total</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isExporting ? '...' : '⬇ Export CSV'}
        </button>
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
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setDocDriver(driver)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          📄 Docs
                        </button>
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

      {/* Pagination */}
      {total > 15 && (
        <div className="flex items-center justify-between px-2 py-2">
          <p className="text-sm text-gray-500">
            Showing {Math.min((page - 1) * 15 + 1, total)}–{Math.min(page * 15, total)} of {total} drivers
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

      {/* Document Viewer Modal */}
      {docDriver && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Driver Documents</h2>
                <p className="text-gray-500 text-sm mt-0.5">{docDriver.user?.fullName} • {docDriver.user?.phone}</p>
              </div>
              <button
                onClick={() => setDocDriver(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Driver info summary */}
              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-xl p-4">
                <div><span className="text-gray-500">License:</span> <span className="font-mono font-semibold">{docDriver.licenseNumber}</span></div>
                <div><span className="text-gray-500">Expiry:</span> <span className="font-semibold">{new Date(docDriver.licenseExpiry).toLocaleDateString('en-ET')}</span></div>
                <div><span className="text-gray-500">Vehicle:</span> <span className="font-semibold">{VEHICLE_ICONS[docDriver.vehicleType]} {docDriver.vehicleModel}</span></div>
                <div><span className="text-gray-500">Plate:</span> <span className="font-mono font-semibold">{docDriver.vehiclePlate}</span></div>
                <div><span className="text-gray-500">City:</span> <span className="font-semibold">{docDriver.city}</span></div>
                <div><span className="text-gray-500">Color:</span> <span className="font-semibold">{docDriver.vehicleColor}</span></div>
              </div>

              {/* Documents */}
              {[
                { key: 'licensePhotoUrl', label: "Driver's License", icon: '🪪' },
                { key: 'idCardUrl', label: 'National ID', icon: '🆔' },
                { key: 'vehiclePhotoUrl', label: 'Vehicle Photo', icon: '🚗' },
              ].map(({ key, label, icon }) => (
                <div key={key}>
                  <p className="text-sm font-semibold text-gray-700 mb-2">{icon} {label}</p>
                  {docDriver[key] ? (
                    <div className="relative group">
                      <img
                        src={`${BACKEND_URL}/${docDriver[key]}`}
                        alt={label}
                        className="w-full rounded-xl border border-gray-200 object-cover max-h-64"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                      <div className="hidden items-center justify-center h-32 bg-gray-100 rounded-xl border border-gray-200 text-gray-400 text-sm">
                        Failed to load image
                      </div>
                      <a
                        href={`${BACKEND_URL}/${docDriver[key]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-2 right-2 bg-white/90 backdrop-blur text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Open ↗
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
                      No document uploaded
                    </div>
                  )}
                </div>
              ))}

              {/* Action buttons */}
              {docDriver.status === 'PENDING' && (
                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => { handleAction(docDriver.id, 'approve'); setDocDriver(null); }}
                    disabled={actionLoading === docDriver.id}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    ✓ Approve Driver
                  </button>
                  <button
                    onClick={() => { handleAction(docDriver.id, 'suspend'); setDocDriver(null); }}
                    disabled={actionLoading === docDriver.id}
                    className="flex-1 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    Reject / Suspend
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
