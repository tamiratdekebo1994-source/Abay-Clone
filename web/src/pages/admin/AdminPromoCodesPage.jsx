import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxUses: 100,
    minOrderAmount: 0,
    maxDiscount: null,
    validFrom: '',
    validTo: '',
  });

  useEffect(() => {
    loadCodes();
  }, [page]);

  const loadCodes = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getPromoCodes({ page, limit: 20 });
      setCodes(data.codes);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createPromoCode(formData);
      setFormData({
        code: '', description: '', discountType: 'PERCENTAGE',
        discountValue: 10, maxUses: 100, minOrderAmount: 0,
        maxDiscount: null, validFrom: '', validTo: '',
      });
      setShowForm(false);
      setPage(1);
      loadCodes();
    } catch (err) {
      alert('Failed to create promo code');
    }
  };

  const handleDeactivate = async (codeId) => {
    if (confirm('Deactivate this promo code?')) {
      try {
        await adminAPI.deactivatePromoCode(codeId);
        loadCodes();
      } catch (err) {
        alert('Failed to deactivate code');
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Promo Codes</h1>
          <p className="text-gray-500 text-sm mt-1">{total} promo codes</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
        >
          + Create Promo Code
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No promo codes yet</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Discount</th>
                <th className="px-6 py-4">Valid</th>
                <th className="px-6 py-4">Uses</th>
                <th className="px-6 py-4">Min Order</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((code) => (
                <tr key={code.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm font-mono text-primary-700">{code.code}</div>
                    <div className="text-xs text-gray-400">{code.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold">
                      {code.discountType === 'PERCENTAGE' ? `${code.discountValue}%` : `ETB ${code.discountValue}`}
                    </div>
                    {code.maxDiscount && <div className="text-xs text-gray-400">Cap: ETB {code.maxDiscount}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div>{new Date(code.validFrom).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-400">{new Date(code.validTo).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div>{code.usedCount} / {code.maxUses || '∞'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">ETB {code.minOrderAmount}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {code.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {code.isActive && (
                      <button
                        onClick={() => handleDeactivate(code.id)}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create Promo Code</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                  placeholder="SUMMER20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                  placeholder="Summer Sale"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (ETB)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Discount Value</label>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Valid From</label>
                <input
                  type="datetime-local"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Valid To</label>
                <input
                  type="datetime-local"
                  value={formData.validTo}
                  onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Min Order Amount (ETB)</label>
                  <input
                    type="number"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Max Uses</label>
                  <input
                    type="number"
                    value={formData.maxUses}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                    min="1"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
                >
                  Create Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
