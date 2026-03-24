import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

const STORE_TYPES = [
  { value: 'GROCERY', label: '🛒 Grocery', am: 'ምግብ ቤት' },
  { value: 'PHARMACY', label: '💊 Pharmacy', am: 'ፋርማሲ' },
  { value: 'RESTAURANT', label: '🍽️ Restaurant', am: 'ምግብ ቤት' },
  { value: 'ELECTRONICS', label: '📱 Electronics', am: 'ኤሌክትሮኒክስ' },
  { value: 'CLOTHING', label: '👗 Clothing', am: 'ልብስ' },
  { value: 'BAKERY', label: '🍞 Bakery', am: 'ዳቦ ቤት' },
  { value: 'OTHER', label: '🏪 Other', am: 'ሌላ' },
];

const ETHIOPIAN_CITIES = [
  'Addis Ababa', 'Dire Dawa', 'Hawassa', 'Bahir Dar',
  'Mekelle', 'Adama', 'Jimma', 'Dessie', 'Gondar',
];

export default function StoreProfile() {
  const { user } = useSelector((s) => s.auth);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/store/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setForm({
          storeName: data.data.storeName || '',
          storeType: data.data.storeType || 'OTHER',
          phone: data.data.phone || '',
          address: data.data.address || '',
          city: data.data.city || 'Addis Ababa',
          subcity: data.data.subcity || '',
          woreda: data.data.woreda || '',
          description: data.data.description || '',
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/store/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { showToast(data.message, 'error'); return; }
      setProfile({ ...profile, ...data.data });
      setIsEditing(false);
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      showToast('Failed to save changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const field = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p className="text-4xl mb-3">🏪</p>
        <p>Store profile not found. Please contact support.</p>
      </div>
    );
  }

  const storeTypeInfo = STORE_TYPES.find((t) => t.value === profile.storeType);

  return (
    <div className="p-6 max-w-3xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? '✓ ' : '✕ '}{toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Profile</h1>
          <p className="text-gray-500 text-sm mt-1">የመደብር መገለጫ</p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            ✏️ Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : '✓ Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Store Header Card */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
            {storeTypeInfo?.label.split(' ')[0] || '🏪'}
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile.storeName}</h2>
            <p className="text-primary-200 text-sm mt-0.5">{storeTypeInfo?.label}</p>
            <div className="flex items-center gap-3 mt-2 text-sm text-primary-200">
              <span>📍 {profile.city}{profile.subcity ? `, ${profile.subcity}` : ''}</span>
              <span>•</span>
              <span>📦 {profile._count?.orders || 0} orders</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            profile.isVerified ? 'bg-green-500/30 text-green-100' : 'bg-yellow-500/30 text-yellow-100'
          }`}>
            {profile.isVerified ? '✓ Verified' : '⏳ Pending Verification'}
          </span>
        </div>
      </div>

      {!isEditing ? (
        /* View Mode */
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm">Store Information</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <Row label="Store Name" value={profile.storeName} />
              <Row label="Store Type" value={storeTypeInfo?.label} />
              <Row label="Phone" value={profile.phone} />
              <Row label="Description" value={profile.description || '—'} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm">Location</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <Row label="City" value={profile.city} />
              <Row label="Subcity" value={profile.subcity || '—'} />
              <Row label="Woreda" value={profile.woreda || '—'} />
              <Row label="Address" value={profile.address} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm">Account</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <Row label="Account Name" value={user?.fullName} />
              <Row label="Phone (login)" value={user?.phone} />
              <Row label="Email" value={user?.email || '—'} />
            </div>
          </div>
        </div>
      ) : (
        /* Edit Mode */
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm border-b border-gray-100 pb-3">Store Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
              <input
                type="text"
                className="input"
                value={form.storeName}
                onChange={(e) => field('storeName', e.target.value)}
                placeholder="e.g. Abebe's Grocery"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Store Type</label>
              <div className="grid grid-cols-2 gap-2">
                {STORE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => field('storeType', t.value)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      form.storeType === t.value
                        ? 'border-primary-600 bg-primary-50 text-primary-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {t.label}
                    <div className="text-xs text-gray-400">{t.am}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                className="input"
                value={form.phone}
                onChange={(e) => field('phone', e.target.value)}
                placeholder="+251 9XX XXX XXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={form.description}
                onChange={(e) => field('description', e.target.value)}
                placeholder="Tell customers about your store..."
              />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm border-b border-gray-100 pb-3">Location</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <select className="input" value={form.city} onChange={(e) => field('city', e.target.value)}>
                {ETHIOPIAN_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcity</label>
                <input
                  type="text"
                  className="input"
                  value={form.subcity}
                  onChange={(e) => field('subcity', e.target.value)}
                  placeholder="e.g. Bole"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Woreda</label>
                <input
                  type="text"
                  className="input"
                  value={form.woreda}
                  onChange={(e) => field('woreda', e.target.value)}
                  placeholder="e.g. 03"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                className="input"
                value={form.address}
                onChange={(e) => field('address', e.target.value)}
                placeholder="e.g. Near Edna Mall, Bole Road"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-gray-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}
