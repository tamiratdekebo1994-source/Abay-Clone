import React, { useState, useEffect } from 'react';

const PAYMENT_METHOD_LABELS = {
  TELEBIRR: { label: 'Telebirr', icon: '📱' },
  CBE_BIRR: { label: 'CBE Birr', icon: '🏦' },
  AWASH_BANK: { label: 'Awash Bank', icon: '🏦' },
  DASHEN_BANK: { label: 'Dashen Bank', icon: '🏦' },
  CASH: { label: 'Cash', icon: '💵' },
};

const STATUS_STYLES = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [processingId, setProcessingId] = useState(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [txRef, setTxRef] = useState('');
  const [actionStatus, setActionStatus] = useState('COMPLETED');
  const [failureReason, setFailureReason] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadWithdrawals();
  }, [filter]);

  const loadWithdrawals = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/wallet/pending?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setWithdrawals(data.data?.withdrawals || data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedWithdrawal) return;
    setProcessingId(selectedWithdrawal.id);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/wallet/${selectedWithdrawal.id}/process`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: actionStatus,
          txRef: txRef || undefined,
          failureReason: actionStatus === 'FAILED' ? failureReason : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message, 'error');
        return;
      }
      showToast(
        actionStatus === 'COMPLETED'
          ? `ETB ${selectedWithdrawal.amount} withdrawal processed successfully`
          : 'Withdrawal marked as failed',
        actionStatus === 'COMPLETED' ? 'success' : 'error'
      );
      setSelectedWithdrawal(null);
      setTxRef('');
      setFailureReason('');
      loadWithdrawals();
    } catch (err) {
      showToast('Failed to process withdrawal', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const totalPending = withdrawals
    .filter((w) => w.status === 'PENDING')
    .reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? '✓ ' : '✕ '}{toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Wallet Withdrawals</h1>
        <p className="text-gray-500 text-sm mt-1">Process driver withdrawal requests • የሾፌር ክፍያ ጥያቄዎች</p>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-yellow-700 text-sm font-medium">Pending Withdrawals</p>
          <p className="text-2xl font-bold text-yellow-800 mt-1">
            ETB {totalPending.toLocaleString()}
          </p>
          <p className="text-yellow-600 text-xs mt-1">
            {withdrawals.filter((w) => w.status === 'PENDING').length} requests
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-sm font-medium">Total Requests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{withdrawals.length}</p>
          <p className="text-gray-400 text-xs mt-1">In current filter</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-sm font-medium">Payment Methods</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {['📱', '🏦', '💵'].map((icon, i) => (
              <span key={i} className="text-lg">{icon}</span>
            ))}
          </div>
          <p className="text-gray-400 text-xs mt-1">Telebirr, Banks, Cash</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === status
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading withdrawals...</div>
        ) : withdrawals.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl mb-2">💸</p>
            <p className="text-gray-500">No {filter.toLowerCase()} withdrawals</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Account</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Requested</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {withdrawals.map((w) => {
                const method = PAYMENT_METHOD_LABELS[w.method] || { label: w.method, icon: '💳' };
                return (
                  <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{w.wallet?.driver?.user?.fullName || 'Driver'}</div>
                      <div className="text-xs text-gray-400">{w.wallet?.driver?.user?.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900">ETB {w.amount?.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{method.icon} {method.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700 font-mono">{w.accountNumber}</div>
                      {w.accountName && (
                        <div className="text-xs text-gray-400">{w.accountName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(w.createdAt).toLocaleDateString('en-ET', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[w.status]}`}>
                        {w.status}
                      </span>
                      {w.txRef && (
                        <div className="text-xs text-gray-400 mt-1">Ref: {w.txRef}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {w.status === 'PENDING' && (
                        <button
                          onClick={() => { setSelectedWithdrawal(w); setActionStatus('COMPLETED'); }}
                          className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 font-medium"
                        >
                          Process
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Process Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Process Withdrawal</h2>
              <p className="text-gray-500 text-sm mt-1">
                {selectedWithdrawal.wallet?.driver?.user?.fullName} •{' '}
                <span className="font-semibold text-gray-700">ETB {selectedWithdrawal.amount?.toLocaleString()}</span>
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Method:</span>
                  <span className="font-medium">
                    {PAYMENT_METHOD_LABELS[selectedWithdrawal.method]?.icon}{' '}
                    {PAYMENT_METHOD_LABELS[selectedWithdrawal.method]?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account:</span>
                  <span className="font-mono font-medium">{selectedWithdrawal.accountNumber}</span>
                </div>
                {selectedWithdrawal.accountName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name:</span>
                    <span className="font-medium">{selectedWithdrawal.accountName}</span>
                  </div>
                )}
              </div>

              {/* Status choice */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <div className="flex gap-3">
                  {['COMPLETED', 'FAILED'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActionStatus(s)}
                      className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                        actionStatus === s
                          ? s === 'COMPLETED'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {s === 'COMPLETED' ? '✓ Mark Paid' : '✕ Mark Failed'}
                    </button>
                  ))}
                </div>
              </div>

              {actionStatus === 'COMPLETED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Reference (optional)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    placeholder="e.g. TBR20240101XXXXX"
                  />
                </div>
              )}

              {actionStatus === 'FAILED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Failure *
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    placeholder="e.g. Invalid account number"
                  />
                </div>
              )}
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => { setSelectedWithdrawal(null); setTxRef(''); setFailureReason(''); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleProcess}
                disabled={processingId === selectedWithdrawal.id || (actionStatus === 'FAILED' && !failureReason)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
                  actionStatus === 'COMPLETED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processingId === selectedWithdrawal.id ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
