import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const SEVERITY_COLORS = {
  LOW: 'bg-yellow-100 text-yellow-700',
  MEDIUM: 'bg-orange-100 text-orange-700',
  HIGH: 'bg-red-100 text-red-700',
  CRITICAL: 'bg-red-200 text-red-900',
};

const STATUS_COLORS = {
  OPEN: 'bg-red-100 text-red-700',
  INVESTIGATING: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-green-100 text-green-700',
  FALSE_ALARM: 'bg-gray-100 text-gray-700',
};

export default function AdminFraudPage() {
  const [flags, setFlags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [resolution, setResolution] = useState('');
  const [newStatus, setNewStatus] = useState('RESOLVED');

  useEffect(() => {
    loadFlags();
  }, [page, statusFilter]);

  const loadFlags = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getFraudFlags({ status: statusFilter, page, limit: 20 });
      setFlags(data.flags);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolution.trim()) {
      alert('Please provide resolution details');
      return;
    }
    try {
      await adminAPI.resolveFraudFlag(selectedFlag.id, { status: newStatus, resolution });
      setSelectedFlag(null);
      setResolution('');
      setNewStatus('RESOLVED');
      loadFlags();
    } catch (err) {
      alert('Failed to resolve fraud flag');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Fraud Detection</h1>
        <p className="text-gray-500 text-sm mt-1">Manage suspicious activity flags</p>
      </div>

      {/* Status Filters */}
      <div className="card p-4 flex gap-2 flex-wrap">
        {['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_ALARM'].map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              statusFilter === status ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : flags.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No fraud flags</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flags.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold">{flag.flagType}</div>
                    <div className="text-xs text-gray-400">{flag.description}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {flag.driver && <div>Driver: {flag.driver.user?.fullName}</div>}
                    {flag.store && <div>Store: {flag.store.storeName}</div>}
                    {flag.customer && <div>Customer: {flag.customer.name}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${SEVERITY_COLORS[flag.severity]}`}>
                      {flag.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[flag.status]}`}>
                      {flag.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(flag.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedFlag(flag)}
                      className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail & Resolution Modal */}
      {selectedFlag && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Fraud Flag Details</h2>
                <p className="text-gray-500 text-sm mt-1">{selectedFlag.flagType}</p>
              </div>
              <button onClick={() => setSelectedFlag(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-bold text-gray-700">Type</p>
                <p className="text-sm text-gray-600">{selectedFlag.flagType}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700">Description</p>
                <p className="text-sm text-gray-600">{selectedFlag.description}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700">Severity</p>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${SEVERITY_COLORS[selectedFlag.severity]}`}>
                  {selectedFlag.severity}
                </span>
              </div>
              {selectedFlag.evidence && (
                <div>
                  <p className="text-sm font-bold text-gray-700">Evidence</p>
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-32">
                    {JSON.stringify(JSON.parse(selectedFlag.evidence), null, 2)}
                  </pre>
                </div>
              )}
              {selectedFlag.status === 'OPEN' && (
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Resolution Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                    >
                      <option value="RESOLVED">Resolved</option>
                      <option value="FALSE_ALARM">False Alarm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Resolution Notes</label>
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                      placeholder="What action was taken..."
                      rows="3"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setSelectedFlag(null)}
                      className="flex-1 py-2 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleResolve}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
