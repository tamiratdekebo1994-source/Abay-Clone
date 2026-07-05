import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const ACTION_COLORS = {
  APPROVE_DRIVER: 'bg-green-100 text-green-700',
  SUSPEND_DRIVER: 'bg-red-100 text-red-700',
  BLOCK_CUSTOMER: 'bg-red-100 text-red-700',
  UNBLOCK_CUSTOMER: 'bg-blue-100 text-blue-700',
  CREATE_PROMO_CODE: 'bg-yellow-100 text-yellow-700',
  DEACTIVATE_PROMO_CODE: 'bg-gray-100 text-gray-700',
  UPDATE_COMMISSION: 'bg-purple-100 text-purple-700',
  REPORT_FRAUD: 'bg-red-100 text-red-700',
  RESOLVE_FRAUD_FLAG: 'bg-green-100 text-green-700',
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ action: '', resource: '' });

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getAuditLogs({ ...filters, page, limit: 50 });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Activity Logs</h1>
        <p className="text-gray-500 text-sm mt-1">Audit trail of all admin actions</p>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No activity logs</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Resource</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold">{log.resource}</div>
                    <div className="text-xs text-gray-400 font-mono">{log.resourceId}</div>
                  </td>
                  <td className="px-6 py-4 text-sm max-w-xs">
                    {log.changes && (
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-16">
                        {JSON.stringify(JSON.parse(log.changes), null, 2)}
                      </pre>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                    <div className="text-xs">{new Date(log.createdAt).toLocaleTimeString()}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {Math.min((page - 1) * 50 + 1, total)}–{Math.min(page * 50, total)} of {total}
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
              onClick={() => setPage((p) => Math.min(Math.ceil(total / 50), p + 1))}
              disabled={page >= Math.ceil(total / 50)}
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
