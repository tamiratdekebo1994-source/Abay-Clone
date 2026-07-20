import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const CITIES = [
  'Addis Ababa', 'Dire Dawa', 'Hawassa', 'Bahir Dar',
  'Mekelle', 'Adama', 'Jimma', 'Dessie', 'Gondar',
];

const MULTIPLIER_COLOR = (m) => {
  if (m >= 2.0) return 'text-red-600 bg-red-50';
  if (m >= 1.5) return 'text-orange-600 bg-orange-50';
  if (m > 1.0) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
};

const PRESET_MULTIPLIERS = [
  { label: 'Normal (1.0x)', value: 1.0 },
  { label: 'Mild (1.2x)', value: 1.2 },
  { label: 'Moderate (1.5x)', value: 1.5 },
  { label: 'High (1.8x)', value: 1.8 },
  { label: 'Very High (2.0x)', value: 2.0 },
  { label: 'Max (2.5x)', value: 2.5 },
];

export default function AdminSurge() {
  const [surgeData, setSurgeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editCity, setEditCity] = useState(null);
  const [editValue, setEditValue] = useState('1.0');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadSurge();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSurge, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSurge = async () => {
    try {
      const { data } = await adminAPI.getSurge();
      if (data.success) setSurgeData(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 1.0 || val > 2.5) {
      showToast('Multiplier must be between 1.0 and 2.5', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const { data } = await adminAPI.setSurge(editCity, val);
      if (!data.success) { showToast(data.message, 'error'); return; }
      showToast(`${editCity} surge set to ${val}x`, 'success');
      setEditCity(null);
      loadSurge();
    } catch (err) {
      showToast('Failed to update surge', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const activeSurgeCount = surgeData.filter((d) => d.isSurge).length;

  return (
    <div className="p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? '✓ ' : '✕ '}{toast.message}
        </div>
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surge Pricing Control</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time surge multipliers per city • የዋጋ ማስፈጸሚያ</p>
        </div>
        <button
          onClick={loadSurge}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-sm">Cities Monitored</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{CITIES.length}</p>
        </div>
        <div className={`rounded-xl p-4 border ${activeSurgeCount > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-sm ${activeSurgeCount > 0 ? 'text-yellow-700' : 'text-gray-500'}`}>Active Surges</p>
          <p className={`text-2xl font-bold mt-1 ${activeSurgeCount > 0 ? 'text-yellow-800' : 'text-gray-900'}`}>
            {activeSurgeCount} {activeSurgeCount > 0 ? '🔥' : ''}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-sm">Max Allowed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">2.5×</p>
        </div>
      </div>

      {/* Peak Hours Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2 text-sm">⏰ Automatic Peak Hours (Ethiopian Time)</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">7–9 AM → 1.3× (Morning rush)</span>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">12–2 PM → 1.2× (Lunch)</span>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">5–8 PM → 1.4× (Evening rush)</span>
        </div>
        <p className="text-xs text-blue-600 mt-2">Manual overrides below replace automatic rates. Set to 1.0 to revert to automatic.</p>
      </div>

      {/* City Cards */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading surge data...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {surgeData.map((city) => (
            <div
              key={city.city}
              className={`bg-white border rounded-xl p-5 ${city.isSurge ? 'border-yellow-300 shadow-sm' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{city.city}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {city.onlineDrivers} drivers • {city.pendingOrders} pending orders
                  </p>
                </div>
                <span className={`text-lg font-black px-2.5 py-0.5 rounded-lg ${MULTIPLIER_COLOR(city.multiplier)}`}>
                  {city.multiplier}×
                </span>
              </div>

              {city.isSurge && city.reason && (
                <div className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-1.5 mb-3">
                  🔥 {city.reason}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>Manual override:</span>
                <span className="font-semibold text-gray-700">
                  {city.manualOverride > 1.0 ? `${city.manualOverride}× (active)` : 'Off'}
                </span>
              </div>

              <button
                onClick={() => { setEditCity(city.city); setEditValue(String(city.manualOverride || 1.0)); }}
                className="w-full text-sm border border-primary-600 text-primary-600 hover:bg-primary-50 rounded-lg py-1.5 font-medium transition-colors"
              >
                Set Override
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editCity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Set Surge for {editCity}</h2>
              <p className="text-gray-500 text-sm mt-1">Range: 1.0× (normal) to 2.5× (maximum)</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Presets */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Quick Presets</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_MULTIPLIERS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setEditValue(String(p.value))}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                        parseFloat(editValue) === p.value
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Value</label>
                <input
                  type="number"
                  min="1.0"
                  max="2.5"
                  step="0.1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-xl font-bold focus:outline-none focus:border-primary-500"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setEditCity(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-accent text-primary rounded-xl text-sm font-semibold hover:bg-accent-dark disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Apply Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
