import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/authSlice';

export default function LoginPage() {
  const [mode, setMode] = useState('otp'); // 'otp' | 'password'
  const [phone, setPhone] = useState('+251');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error, user } = useSelector((s) => s.auth);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === 'ADMIN' ? '/admin' : '/store', { replace: true });
    }
  }, [isAuthenticated, user]);

  // ── OTP Flow ──────────────────────────────────────────────────────────────
  const sendOtp = async () => {
    setOtpLoading(true); setOtpError('');
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'LOGIN' }),
      });
      const data = await res.json();
      if (!data.success) {
        if (res.status === 404) {
          setOtpError('Phone not registered. Please sign up first.');
        } else {
          setOtpError(data.message);
        }
        return;
      }
      setOtpSent(true);
      setCountdown(60);
      const timer = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; }), 1000);
      if (data.data?.devCode) {
        setOtp(data.data.devCode);
        setOtpError(`[Dev] Code pre-filled: ${data.data.devCode}`);
      }
    } catch { setOtpError('Network error. Please try again.'); }
    finally { setOtpLoading(false); }
  };

  const verifyOtpAndLogin = async () => {
    setOtpLoading(true); setOtpError('');
    try {
      const res = await fetch('/api/auth/otp/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json();
      if (!data.success) { setOtpError(data.message); return; }
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      window.location.href = '/';
    } catch { setOtpError('Login failed. Please try again.'); }
    finally { setOtpLoading(false); }
  };

  // ── Password Flow (Admin) ─────────────────────────────────────────────────
  const handlePasswordLogin = (e) => {
    e.preventDefault();
    dispatch(login({ phone, password }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent rounded-2xl mb-4 shadow-lg">
            <span className="text-primary-800 font-black text-2xl">ET Spark Driver</span>
          </div>
          <h1 className="text-3xl font-black text-white">ET Spark Driver</h1>
          <p className="text-primary-200 mt-1">Ethiopia's Delivery Network • የኢትዮጵያ የማድረስ አውታር</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Mode Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
            <button
              onClick={() => { setMode('otp'); dispatch(clearError()); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mode === 'otp' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              📱 OTP Login
            </button>
            <button
              onClick={() => { setMode('password'); setOtpError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mode === 'password' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              🔐 Admin Login
            </button>
          </div>

          {/* ── OTP Mode ── */}
          {mode === 'otp' && (
            <div>
              {(otpError) && (
                <div className={`border rounded-lg p-3 mb-4 text-sm ${otpError.startsWith('[Dev]') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {otpError}
                </div>
              )}

              <div className="mb-4">
                <label className="label">Phone Number / ስልክ ቁጥር</label>
                <div className="flex gap-2">
                  <span className="flex items-center bg-gray-100 border border-gray-300 rounded-lg px-3 text-xl">🇪🇹</span>
                  <input
                    type="tel"
                    className="input flex-1"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setOtpError(''); setOtpSent(false); setOtp(''); }}
                    placeholder="+251912345678"
                    maxLength={13}
                    disabled={otpSent}
                  />
                </div>
              </div>

              {!otpSent ? (
                <button onClick={sendOtp} className="btn-primary w-full py-3" disabled={otpLoading || phone.length < 13}>
                  {otpLoading ? <span className="inline-block animate-spin mr-2">⟳</span> : null}
                  Send Verification Code / ኮድ ላክ
                </button>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="label">
                      6-digit code sent to {phone}
                      <button onClick={() => { setOtpSent(false); setOtp(''); }} className="text-xs text-primary-600 ml-2 font-normal hover:underline">Change</button>
                    </label>
                    <input
                      type="text"
                      className="input text-center text-2xl tracking-[0.5em] font-bold"
                      value={otp}
                      onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                      maxLength={6}
                      placeholder="______"
                      autoFocus
                    />
                  </div>
                  <button onClick={verifyOtpAndLogin} className="btn-primary w-full py-3 mb-3" disabled={otpLoading || otp.length < 6}>
                    {otpLoading ? 'Verifying...' : 'Sign In / ግባ ✓'}
                  </button>
                  <button onClick={sendOtp} className="w-full text-sm text-primary-600 py-2 disabled:text-gray-400" disabled={countdown > 0 || otpLoading}>
                    {countdown > 0 ? `Resend in ${countdown}s` : '↩ Resend code'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Password Mode (Admin) ── */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">{error}</div>
              )}
              <div className="mb-4">
                <label className="label">Phone / ስልክ</label>
                <input type="tel" className="input" value={phone} onChange={(e) => { setPhone(e.target.value); dispatch(clearError()); }} placeholder="+251 9XX XXX XXX" required />
              </div>
              <div className="mb-5">
                <label className="label">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className="input pr-10" value={password} onChange={(e) => { setPassword(e.target.value); dispatch(clearError()); }} required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? '🙈' : '👁️'}</button>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-3" disabled={isLoading}>
                {isLoading ? <span className="inline-block animate-spin mr-2">⟳</span> : null}
                Sign In / ግባ
              </button>
            </form>
          )}

          {/* Demo credentials */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Quick Demo:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button onClick={() => { setPhone('+251922000001'); setMode('otp'); setOtpSent(false); setOtp(''); }}
                className="bg-gray-50 hover:bg-gray-100 p-2 rounded-lg text-left transition-colors">
                🏪 Store Login<br/><span className="text-gray-400">+251922000001</span>
              </button>
              <button onClick={() => { setPhone('+251911000000'); setPassword('Admin@1234'); setMode('password'); }}
                className="bg-gray-50 hover:bg-gray-100 p-2 rounded-lg text-left transition-colors">
                👑 Admin Login<br/><span className="text-gray-400">+251911000000</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-primary-200 text-sm mt-6">
          New store owner?{' '}
          <Link to="/register" className="text-accent font-semibold hover:underline">Register here / ይመዝገቡ</Link>
        </p>
        <p className="text-center text-primary-300 text-xs mt-2">🇪🇹 Made for Ethiopia</p>
      </div>
    </div>
  );
}
