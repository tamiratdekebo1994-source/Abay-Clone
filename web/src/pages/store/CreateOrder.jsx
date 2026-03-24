import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderAPI } from '../../services/api';

const PAYMENT_METHODS = [
  { value: 'TELEBIRR', label: 'Telebirr', emoji: '📱' },
  { value: 'CBE_BIRR', label: 'CBE Birr', emoji: '🏦' },
  { value: 'AWASH_BANK', label: 'Awash Bank', emoji: '🏦' },
  { value: 'CASH', label: 'Cash / ጥሬ ገንዘብ', emoji: '💵' },
];

const ADDIS_LOCATIONS = [
  { name: 'Bole', lat: 8.9946, lng: 38.7906 },
  { name: 'Kazanchis', lat: 9.0198, lng: 38.7526 },
  { name: 'Piassa', lat: 9.0282, lng: 38.7469 },
  { name: 'Merkato', lat: 9.0121, lng: 38.7468 },
  { name: 'CMC', lat: 9.0395, lng: 38.8092 },
  { name: 'Ayat', lat: 8.9760, lng: 38.8467 },
  { name: '4 Kilo', lat: 9.0434, lng: 38.7614 },
  { name: 'Lideta', lat: 9.0029, lng: 38.7395 },
];

export default function CreateOrder() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const estimateTimer = useRef(null);

  const [form, setForm] = useState({
    pickupAddress: '', pickupLat: '9.0121', pickupLng: '38.7468', pickupNotes: '',
    deliveryAddress: '', deliveryLat: '9.0198', deliveryLng: '38.7526', deliveryNotes: '',
    recipientName: '', recipientPhone: '',
    description: '', weight: '', isFragile: false, requiresRefrigeration: false,
    paymentMethod: 'TELEBIRR',
  });

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePickupLocation = (loc) => {
    setForm((prev) => ({ ...prev, pickupAddress: `${loc.name}, Addis Ababa`, pickupLat: String(loc.lat), pickupLng: String(loc.lng) }));
  };
  const handleDeliveryLocation = (loc) => {
    setForm((prev) => ({ ...prev, deliveryAddress: `${loc.name}, Addis Ababa`, deliveryLat: String(loc.lat), deliveryLng: String(loc.lng) }));
  };

  // Debounced fare estimate whenever coords or cargo options change
  const fetchEstimate = useCallback(async (currentForm) => {
    if (!currentForm.pickupLat || !currentForm.deliveryLat) return;
    if (currentForm.pickupLat === currentForm.deliveryLat && currentForm.pickupLng === currentForm.deliveryLng) {
      setEstimate(null);
      return;
    }
    try {
      setEstimating(true);
      const { data } = await orderAPI.estimate({
        pickupLat: currentForm.pickupLat,
        pickupLng: currentForm.pickupLng,
        deliveryLat: currentForm.deliveryLat,
        deliveryLng: currentForm.deliveryLng,
        isFragile: currentForm.isFragile,
        requiresRefrigeration: currentForm.requiresRefrigeration,
      });
      if (data.success) setEstimate(data.data);
    } catch (_) { /* silent */ }
    finally { setEstimating(false); }
  }, []);

  useEffect(() => {
    clearTimeout(estimateTimer.current);
    estimateTimer.current = setTimeout(() => fetchEstimate(form), 600);
    return () => clearTimeout(estimateTimer.current);
  }, [form.pickupLat, form.pickupLng, form.deliveryLat, form.deliveryLng, form.isFragile, form.requiresRefrigeration]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { data } = await orderAPI.create(form);
      navigate(`/store/orders/${data.data.id}/track`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create order');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">New Delivery Order</h1>
        <p className="text-gray-500 mt-1">አዲስ የማድረስ ትዕዛዝ</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pickup */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-green-500">●</span> Pickup Location / መነሻ ቦታ
          </h2>
          <div className="mb-3">
            <label className="label">Quick Select Area</label>
            <div className="flex flex-wrap gap-2">
              {ADDIS_LOCATIONS.map((loc) => (
                <button key={loc.name} type="button" onClick={() => handlePickupLocation(loc)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    form.pickupAddress.includes(loc.name)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}>{loc.name}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="label">Full Address *</label>
              <input className="input" value={form.pickupAddress} onChange={set('pickupAddress')} required placeholder="e.g. Merkato, Addis Ketema, Addis Ababa" />
            </div>
            <div>
              <label className="label">Pickup Notes (optional)</label>
              <input className="input" value={form.pickupNotes} onChange={set('pickupNotes')} placeholder="e.g. Call when arriving" />
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-red-500">●</span> Delivery Location / መድረሻ ቦታ
          </h2>
          <div className="mb-3">
            <label className="label">Quick Select Area</label>
            <div className="flex flex-wrap gap-2">
              {ADDIS_LOCATIONS.map((loc) => (
                <button key={loc.name} type="button" onClick={() => handleDeliveryLocation(loc)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    form.deliveryAddress.includes(loc.name)
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                  }`}>{loc.name}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Delivery Address *</label>
              <input className="input" value={form.deliveryAddress} onChange={set('deliveryAddress')} required placeholder="Full delivery address" />
            </div>
            <div>
              <label className="label">Recipient Name *</label>
              <input className="input" value={form.recipientName} onChange={set('recipientName')} required placeholder="Full name" />
            </div>
            <div>
              <label className="label">Recipient Phone *</label>
              <input className="input" type="tel" value={form.recipientPhone} onChange={set('recipientPhone')} required placeholder="+251 9XX XXX XXX" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Delivery Notes (optional)</label>
              <input className="input" value={form.deliveryNotes} onChange={set('deliveryNotes')} placeholder="e.g. Ring doorbell, apartment 4B" />
            </div>
          </div>
        </div>

        {/* Package */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">📦 Package Details / ጥቅል መረጃ</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Package Description *</label>
              <input className="input" value={form.description} onChange={set('description')} required placeholder="What are you delivering?" />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input className="input" type="number" step="0.1" min="0" value={form.weight} onChange={set('weight')} placeholder="Optional" />
            </div>
            <div className="flex flex-col gap-3 pt-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-primary-600" checked={form.isFragile} onChange={set('isFragile')} />
                <span className="text-sm font-medium text-gray-700">⚠️ Fragile Item (+10%)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-primary-600" checked={form.requiresRefrigeration} onChange={set('requiresRefrigeration')} />
                <span className="text-sm font-medium text-gray-700">❄️ Requires Refrigeration (+20%)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Fare Estimate */}
        {(estimating || estimate) && (
          <div className={`card border-2 ${estimate?.surge?.isSurge ? 'border-orange-300 bg-orange-50' : 'border-primary-200 bg-primary-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">💰 Fare Estimate / የዋጋ ግምት</h2>
              {estimating && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary-600 border-t-transparent" />
                  Calculating...
                </span>
              )}
              {estimate?.surge?.isSurge && !estimating && (
                <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full">
                  🔥 {estimate.surge.multiplier}× Surge — {estimate.surge.reason}
                </span>
              )}
            </div>
            {estimate && !estimating && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-gray-500">Distance</p>
                  <p className="text-lg font-black text-gray-900">{estimate.distanceKm} km</p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-gray-500">Driver Fee</p>
                  <p className="text-lg font-black text-primary-700">ETB {estimate.driverFee?.toFixed(0)}</p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-gray-500">Platform Fee</p>
                  <p className="text-lg font-black text-gray-500">ETB {estimate.platformFee?.toFixed(0)}</p>
                </div>
                <div className={`rounded-xl p-3 shadow-sm ${estimate.surge?.isSurge ? 'bg-orange-100' : 'bg-white'}`}>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className={`text-lg font-black ${estimate.surge?.isSurge ? 'text-orange-700' : 'text-gray-900'}`}>
                    ETB {estimate.totalAmount?.toFixed(0)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-1">💳 Payment Method / የክፍያ ዘዴ</h2>
          <p className="text-xs text-gray-400 mb-4">
            Online payments (Telebirr, CBE) will redirect to the payment gateway after order creation.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PAYMENT_METHODS.map((method) => (
              <label key={method.value}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  form.paymentMethod === method.value
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}>
                <input type="radio" name="paymentMethod" value={method.value}
                  checked={form.paymentMethod === method.value} onChange={set('paymentMethod')} className="hidden" />
                <span className="text-2xl">{method.emoji}</span>
                <span className="text-xs font-semibold text-center">{method.label}</span>
                {(method.value === 'TELEBIRR' || method.value === 'CBE_BIRR') && (
                  <span className="text-[10px] text-green-600 font-medium">Online ✓</span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={isLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : `🚀 Create Order${estimate ? ` — ETB ${estimate.totalAmount?.toFixed(0)}` : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
}
