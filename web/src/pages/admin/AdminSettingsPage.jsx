import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    platformCommissionPercent: 15,
    driverCommissionPercent: 85,
    minimumOrderValue: 0,
    surgeCommissionBonus: 0.05,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const { data } = await adminAPI.getCommissionSettings();
      setSettings(data);
      setFormData({
        platformCommissionPercent: data.platformCommissionPercent,
        driverCommissionPercent: data.driverCommissionPercent,
        minimumOrderValue: data.minimumOrderValue,
        surgeCommissionBonus: data.surgeCommissionBonus,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    const num = parseFloat(value);
    setFormData({ ...formData, [field]: num });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if ((formData.platformCommissionPercent + formData.driverCommissionPercent) !== 100) {
      alert('Platform + Driver commission must equal 100%');
      return;
    }

    setIsSaving(true);
    try {
      const { data } = await adminAPI.updateCommissionSettings(formData);
      setSettings(data);
      alert('Commission settings updated successfully');
    } catch (err) {
      alert('Failed to update settings: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const platformPct = formData.platformCommissionPercent;
  const driverPct = formData.driverCommissionPercent;
  const totalPct = platformPct + driverPct;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Commission Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure platform and driver commission rates</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Commission Breakdown Card */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-6">Commission Distribution</h2>

          <div className="space-y-6">
            {/* Platform Commission */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-gray-700">Platform Commission</label>
                <span className="text-sm font-bold text-primary-700">{platformPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={platformPct}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setFormData({
                    ...formData,
                    platformCommissionPercent: val,
                    driverCommissionPercent: 100 - val,
                  });
                }}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                What the platform takes from each order (e.g., 15% of order value)
              </div>
            </div>

            {/* Driver Commission */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-gray-700">Driver Commission</label>
                <span className="text-sm font-bold text-blue-700">{driverPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={driverPct}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setFormData({
                    ...formData,
                    driverCommissionPercent: val,
                    platformCommissionPercent: 100 - val,
                  });
                }}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                What drivers earn from each order
              </div>
            </div>

            {/* Validation */}
            <div className={`p-4 rounded-lg ${
              totalPct === 100
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <p className="text-sm font-bold">
                {totalPct === 100 ? '✓ Distribution is balanced (100%)' : `⚠ Distribution is ${totalPct}% (must be 100%)`}
              </p>
            </div>
          </div>
        </div>

        {/* Additional Settings */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-6">Additional Settings</h2>

          <div className="space-y-6">
            {/* Minimum Order Value */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Minimum Order Value (ETB)
              </label>
              <input
                type="number"
                value={formData.minimumOrderValue}
                onChange={(e) => handleChange('minimumOrderValue', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                min="0"
                step="10"
              />
              <div className="text-xs text-gray-500 mt-1">
                Minimum order total for commission to apply
              </div>
            </div>

            {/* Surge Bonus */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Surge Commission Bonus (%)
              </label>
              <input
                type="number"
                value={formData.surgeCommissionBonus}
                onChange={(e) => handleChange('surgeCommissionBonus', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
                min="0"
                step="0.01"
                max="1"
              />
              <div className="text-xs text-gray-500 mt-1">
                Extra commission drivers earn during surge (e.g., 5% bonus during 1.5x surge)
              </div>
            </div>
          </div>
        </div>

        {/* Example Calculation */}
        <div className="card p-6 bg-blue-50 border border-blue-200">
          <h3 className="font-bold text-blue-900 mb-4">Example Calculation</h3>
          <div className="space-y-2 text-sm text-blue-900">
            <div className="flex justify-between">
              <span>Customer pays for order:</span>
              <span className="font-bold">ETB 100</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee ({platformPct}%):</span>
              <span className="font-bold text-primary-700">ETB {(100 * platformPct / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Driver earnings ({driverPct}%):</span>
              <span className="font-bold text-blue-700">ETB {(100 * driverPct / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={loadSettings}
            className="flex-1 py-3 text-gray-700 border border-gray-200 rounded-lg font-bold hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSaving || totalPct !== 100}
            className="flex-1 py-3 bg-accent text-primary rounded-lg font-bold hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {settings && (
          <p className="text-xs text-gray-500 text-center">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}
      </form>
    </div>
  );
}
