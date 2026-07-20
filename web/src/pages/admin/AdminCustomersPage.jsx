import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBlocked, setShowBlocked] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [blockReason, setBlockReason] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    loadCustomers();
  }, [showBlocked, page]);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getCustomers({
        isBlocked: showBlocked ? 'true' : undefined,
        page,
        limit: 20,
      });
      setCustomers(data.data.customers);
      setTotal(data.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlock = async (customer) => {
    if (!blockReason.trim()) {
      alert('Please provide a reason for blocking');
      return;
    }
    try {
      await adminAPI.blockCustomer(customer.id, blockReason);
      setSelectedCustomer(null);
      setBlockReason('');
      loadCustomers();
    } catch (err) {
      alert('Failed to block customer');
    }
  };

  const handleUnblock = async (customerId) => {
    try {
      await adminAPI.unblockCustomer(customerId);
      loadCustomers();
    } catch (err) {
      alert('Failed to unblock customer');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Customer Management</h1>
          <p className="text-gray-500 text-sm mt-1">{total} customers</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-4 flex gap-2">
        <button
          onClick={() => { setShowBlocked(false); setPage(1); }}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            !showBlocked ? 'bg-accent text-primary' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Active Customers
        </button>
        <button
          onClick={() => { setShowBlocked(true); setPage(1); }}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            showBlocked ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Blocked
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No customers found</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">City</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Total Spent</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-sm">{customer.name}</div>
                    {customer.email && <div className="text-xs text-gray-400">{customer.email}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono">{customer.phone}</td>
                  <td className="px-6 py-4 text-sm">{customer.city}</td>
                  <td className="px-6 py-4 text-sm">{customer.totalOrders}</td>
                  <td className="px-6 py-4 text-sm font-bold">ETB {customer.totalSpent?.toFixed(0)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      customer.isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {customer.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {customer.isBlocked ? (
                      <button
                        onClick={() => handleUnblock(customer.id)}
                        className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium"
                      >
                        Unblock
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium"
                      >
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Block Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Block Customer</h2>
              <p className="text-gray-500 text-sm mt-1">{selectedCustomer.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700">Reason for blocking:</label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full mt-2 p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                  placeholder="Fraudulent activity, disputes, etc."
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedCustomer(null); setBlockReason(''); }}
                  className="flex-1 py-2 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBlock(selectedCustomer)}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                >
                  Block Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
