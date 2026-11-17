import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authAPI, storeAPI } from '../services/api';
import { saveSession, sessionStarted } from '../store/authSlice';

const STEP_LABELS = ['Phone Verification', 'Your Details', 'Store Information'];

const ETHIOPIAN_CITIES = [
  'Addis Ababa', 'Dire Dawa', 'Hawassa', 'Bahir Dar',
  'Mekelle', 'Adama', 'Jimma', 'Dessie', 'Gondar',
];

const STORE_TYPES = [
  { value: 'Supermarket', emoji: '🛒', label: 'Supermarket / ሱቅ' },
  { value: 'Pharmacy', emoji: '💊', label: 'Pharmacy / ፋርማሲ' },
  { value: 'Restaurant', emoji: '🍽️', label: 'Restaurant / ምግብ ቤት' },
  { value: 'Electronics', emoji: '📱', label: 'Electronics / ኤሌክትሮኒክስ' },
  { value: 'Clothing', emoji: '👕', label: 'Clothing / ልብስ' },
  { value: 'Books', emoji: '📚', label: 'Books & Stationery' },
  { value: 'Bakery', emoji: '🥐', label: 'Bakery / ቤዛ' },
  { value: 'Other', emoji: '🏪', label: 'Other / ሌላ' },
];

// Addis Ababa subcities
const ADDIS_SUBCITIES = [
  'Addis Ketema', 'Akaky Kaliti', 'Arada', 'Bole', 'Gullele',
  'Kirkos', 'Kolfe Keranio', 'Lideta', 'Nifas Silk-Lafto', 'Yeka',
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 - Phone
  const [phone, setPhone] = useState('+251');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [verificationToken, setVerificationToken] = useState('');

  // Step 2 - Personal (password is what the store signs in with)
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 - Personal
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Step 3 - Store
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Addis Ababa');
  const [subcity, setSubcity] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [description, setDescription] = useState('');

  // Demo coordinates for common areas
  const AREA_COORDS = {
    'Bole': { lat: 8.9946, lng: 38.7906 },
    'Kazanchis': { lat: 9.0198, lng: 38.7526 },
    'Piassa': { lat: 9.0282, lng: 38.7469 },
    'Merkato': { lat: 9.0121, lng: 38.7468 },
  };

  const sendOtp = async () => {
    if (phone.length < 13) { setError('Please enter a valid phone number'); return; }
    setIsLoading(true); setError('');
    try {
      const { data } = await authAPI.requestOtp(phone, 'REGISTER');
      if (!data.success) { setError(data.message); return; }
      setOtpSent(true);
      setCountdown(60);
      const timer = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; }), 1000);
      // Dev code
      if (data.data?.devCode) {
        setOtp(data.data.devCode);
        setError(`[Dev] Code: ${data.data.devCode}`);
      }
    } catch (err) { setError(err.response?.data?.message || 'Network error. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) { setError('Please enter the 6-digit code'); return; }
    setIsLoading(true); setError('');
    try {
      const { data } = await authAPI.verifyOtpRegister(phone, otp);
      if (!data.success) { setError(data.message); return; }
      setVerificationToken(data.data.verificationToken);
      setStep(2);
    } catch (err) { setError(err.response?.data?.message || 'Verification failed. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const createAccount = async () => {
    if (!fullName.trim()) { setError('Please enter your full name'); return; }
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setIsLoading(true); setError('');
    try {
      const { data } = await authAPI.completeRegistration({
        verificationToken, fullName, email: email.trim(), role: 'STORE', password,
      });
      if (!data.success) { setError(data.message); return; }
      // Start the session in Redux too, or the role guard sends the user back to login.
      saveSession(data.data.accessToken, data.data.user);
      dispatch(sessionStarted(data.data.user));
      setStep(3);
    } catch (err) { setError(err.response?.data?.message || 'Failed to create account.'); }
    finally { setIsLoading(false); }
  };

  const registerStore = async () => {
    if (!storeName || !storeType || !address || !city) {
      setError('Please fill in all required fields'); return;
    }
    setIsLoading(true); setError('');
    try {
      const coords = AREA_COORDS[subcity] || { lat: 9.0192, lng: 38.7525 };
      const { data } = await storeAPI.register({
        storeName, storeType, address, city, subcity, phone: storePhone || phone,
        description, lat: coords.lat, lng: coords.lng,
      });
      if (!data.success) { setError(data.message); return; }
      navigate('/store');
    } catch (err) { setError(err.response?.data?.message || 'Failed to register store.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-accent flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary-700 rounded-3xl mb-4 shadow-2xl">
            <span className="text-accent text-3xl">⚡</span>
          </div>
          <h1 className="text-3xl font-black text-primary">Join ET SPARK</h1>
          <p className="text-primary font-bold text-xs mt-2">DELIVERY NETWORK</p>
          <p className="text-primary/60 text-sm mt-2">Register your store / መደብርዎን ይመዝገቡ</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEP_LABELS.map((label, idx) => (
            <React.Fragment key={idx}>
              <div className={`flex items-center gap-1.5 ${idx + 1 <= step ? 'text-primary' : 'text-primary/40'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${idx + 1 < step ? 'bg-primary text-accent' : idx + 1 === step ? 'bg-white text-primary-700' : 'bg-primary-500 text-primary-200'}`}>
                  {idx + 1 < step ? '✓' : idx + 1}
                </div>
                <span className="text-xs hidden sm:block">{label}</span>
              </div>
              {idx < 2 && <div className={`flex-1 h-0.5 max-w-12 ${idx + 1 < step ? 'bg-primary' : 'bg-primary-500'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className={`border rounded-lg p-3 mb-5 text-sm ${error.startsWith('[Dev]') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {error}
            </div>
          )}

          {/* ── Step 1: Phone + OTP ── */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Phone Verification</h2>
              <p className="text-gray-500 text-sm mb-6">ስልክዎን ያረጋግጡ</p>

              <div className="mb-4">
                <label className="label">Phone Number / ስልክ ቁጥር</label>
                <div className="flex gap-2">
                  <div className="flex items-center bg-gray-100 border border-gray-300 rounded-lg px-3 text-xl">🇪🇹</div>
                  <input
                    type="tel"
                    className="input flex-1"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(''); }}
                    placeholder="+251912345678"
                    maxLength={13}
                    disabled={otpSent}
                  />
                </div>
              </div>

              {!otpSent ? (
                <button onClick={sendOtp} className="btn-primary w-full py-3" disabled={isLoading}>
                  {isLoading ? <span className="inline-block animate-spin mr-2">⟳</span> : null}
                  Send Verification Code / ኮድ ላክ
                </button>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="label">Enter 6-digit code sent to {phone}</label>
                    <input
                      type="text"
                      className="input text-center text-2xl tracking-[0.5em] font-bold"
                      value={otp}
                      onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                      maxLength={6}
                      placeholder="______"
                      autoFocus
                    />
                  </div>
                  <button onClick={verifyOtp} className="btn-primary w-full py-3 mb-3" disabled={isLoading || otp.length < 6}>
                    {isLoading ? 'Verifying...' : 'Verify Code / አረጋግጥ ✓'}
                  </button>
                  <button
                    onClick={sendOtp}
                    className="w-full text-sm text-primary-600 py-2 disabled:text-gray-400"
                    disabled={countdown > 0 || isLoading}
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Personal Details ── */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Your Details</h2>
              <p className="text-gray-500 text-sm mb-6">Phone verified ✓ {phone}</p>

              <div className="space-y-4">
                <div>
                  <label className="label">Full Name / ሙሉ ስም *</label>
                  <input className="input" value={fullName} onChange={e => { setFullName(e.target.value); setError(''); }} placeholder="e.g. Almaz Tadesse" autoFocus />
                </div>
                <div>
                  <label className="label">Email * (you sign in with this)</label>
                  <input className="input" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="you@example.com" required />
                </div>
                <div>
                  <label className="label">Password * (at least 8 characters)</label>
                  <input className="input" type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder="Choose a password" autoComplete="new-password" />
                </div>
                <div>
                  <label className="label">Confirm Password *</label>
                  <input className="input" type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError(''); }} placeholder="Type it again" autoComplete="new-password" />
                </div>
              </div>

              <button onClick={createAccount} className="btn-primary w-full py-3 mt-6" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Continue / ቀጥል →'}
              </button>
            </div>
          )}

          {/* ── Step 3: Store Info ── */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Store Information</h2>
              <p className="text-gray-500 text-sm mb-5">Account created ✓ Now set up your store</p>

              <div className="space-y-4">
                <div>
                  <label className="label">Store Name / የመደብር ስም *</label>
                  <input className="input" value={storeName} onChange={e => { setStoreName(e.target.value); setError(''); }} placeholder="e.g. Bole Supermarket" autoFocus />
                </div>

                <div>
                  <label className="label">Store Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STORE_TYPES.map(s => (
                      <button key={s.value} type="button"
                        onClick={() => { setStoreType(s.value); setError(''); }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm font-medium text-left transition-colors ${storeType === s.value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-primary-300'}`}
                      >
                        <span>{s.emoji}</span><span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">City *</label>
                    <select className="input" value={city} onChange={e => setCity(e.target.value)}>
                      {ETHIOPIAN_CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  {city === 'Addis Ababa' && (
                    <div>
                      <label className="label">Subcity</label>
                      <select className="input" value={subcity} onChange={e => setSubcity(e.target.value)}>
                        <option value="">Select...</option>
                        {ADDIS_SUBCITIES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Full Address *</label>
                  <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Bole Road, Near Edna Mall" />
                </div>

                <div>
                  <label className="label">Store Phone</label>
                  <input className="input" type="tel" value={storePhone} onChange={e => setStorePhone(e.target.value)} placeholder="+251 9XX XXX XXX" />
                </div>

                <div>
                  <label className="label">Description (optional)</label>
                  <textarea className="input resize-none" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of your store..." />
                </div>
              </div>

              <button onClick={registerStore} className="btn-primary w-full py-3 mt-6" disabled={isLoading}>
                {isLoading ? 'Registering...' : '🎉 Create My Store'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center mt-4 text-primary/70 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
