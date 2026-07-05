import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/authSlice';

export default function LoginPage() {
  const [mode, setMode] = useState('otp');
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
        setOtpError(res.status === 404 ? 'Phone not registered. Please sign up first.' : data.message);
        return;
      }
      setOtpSent(true);
      setCountdown(60);
      const timer = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; }), 1000);
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

  const handlePasswordLogin = (e) => {
    e.preventDefault();
    dispatch(login({ phone, password }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo & Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-accent to-yellow-400 rounded-3xl mb-6 shadow-2xl">
            <span className="text-primary-900 font-black text-4xl">⚡</span>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter">ET SPAR</h1>
          <p className="text-accent font-bold text-sm mt-2">DELIVERY NETWORK</p>
          <p className="text-primary-300 mt-3 text-xs">Fast • Reliable • Connected</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => { setMode('otp'); dispatch(clearError()); setOtpError(''); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === 'otp' ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50' : 'text-gray-400 hover:text-gray-600'}`}
            >
              📱 Sign In with OTP
            </button>
            <button
              onClick={() => { setMode('password'); setOtpError(''); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === 'password' ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50' : 'text-gray-400 hover:text-gray-600'}`}
            >
              🔐 Admin Sign In
            </button>
          </div>

          <div className="p-8">

            {/* OTP Mode */}
            {mode === 'otp' && (
              <div>
                {otpError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-sm text-red-700">
                    ⚠ {otpError}
                  </div>
                )}
                <div className="mb-5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <span className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-xl select-none">🇪🇹</span>
                    <input
                      type="tel"
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setOtpError(''); setOtpSent(false); setOtp(''); }}
                      placeholder="+251912345678"
                      maxLength={13}
                      disabled={otpSent}
                    />
                  </div>
                </div>

                {!otpSent ? (
                  <button
                    onClick={sendOtp}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-40"
                    disabled={otpLoading || phone.length < 13}
                  >
                    {otpLoading ? 'Sending...' : 'Send Verification Code →'}
                  </button>
                ) : (
                  <>
                    <div className="mb-5">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        6-digit code sent to {phone}
                        <button onClick={() => { setOtpSent(false); setOtp(''); }} className="ml-2 text-primary-600 normal-case font-normal hover:underline">
                          Change
                        </button>
                      </label>
                      <input
                        type="text"
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-3xl tracking-[0.6em] font-bold focus:outline-none focus:border-primary-500"
                        value={otp}
                        onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                        maxLength={6}
                        placeholder="——————"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={verifyOtpAndLogin}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-40 mb-3"
                      disabled={otpLoading || otp.length < 6}
                    >
                      {otpLoading ? 'Verifying...' : 'Sign In ✓'}
                    </button>
                    <button
                      onClick={sendOtp}
                      className="w-full text-sm text-primary-600 py-2 disabled:text-gray-300 hover:underline"
                      disabled={countdown > 0 || otpLoading}
                    >
                      {countdown > 0 ? `Resend code in ${countdown}s` : '↩ Resend code'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Password Mode (Admin) */}
            {mode === 'password' && (
              <form onSubmit={handlePasswordLogin}>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-sm text-red-700">
                    ⚠ {error}
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); dispatch(clearError()); }}
                    placeholder="+251 9XX XXX XXX"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); dispatch(clearError()); }}
                      required
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                      {showPw ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-40" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In →'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-primary-200 text-sm mt-8">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent font-bold hover:text-yellow-300 transition-colors">Create Account</Link>
        </p>
        <p className="text-center text-primary-400 text-xs mt-3">© 2025 ET SPAR • Powering Ethiopia</p>
      </div>
    </div>
  );
}
