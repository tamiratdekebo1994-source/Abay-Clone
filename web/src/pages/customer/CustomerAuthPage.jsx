import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api, { authAPI } from '../../services/api';
import { saveSession, sessionStarted } from '../../store/authSlice';

// Phone sign-in for customers. A new number signs up with a name; an existing
// number just gets a code. Only CUSTOMER accounts can use this page.
export default function CustomerAuthPage() {
  const [step, setStep] = useState('phone'); // phone -> code -> name
  const [mode, setMode] = useState('login'); // login | register
  const [phone, setPhone] = useState('+251');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [verificationToken, setVerificationToken] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((s) => s.auth);

  if (isAuthenticated && user?.role === 'CUSTOMER') {
    return <Navigate to="/customer" replace />;
  }

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const startSession = async (accessToken) => {
    localStorage.setItem('accessToken', accessToken);
    const { data } = await api.get('/auth/me');
    const me = data.data;
    if (me.role !== 'CUSTOMER') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      throw new Error('This number is registered as a store or driver. Use the business sign-in instead.');
    }
    saveSession(accessToken, me);
    dispatch(sessionStarted(me));
    navigate('/customer', { replace: true });
  };

  const requestCode = () => run(async () => {
    try {
      await authAPI.requestOtp(phone, 'LOGIN');
      setMode('login');
    } catch (err) {
      if (err.response?.status !== 404) throw err;
      // No account yet — send a sign-up code instead.
      await authAPI.requestOtp(phone, 'REGISTER');
      setMode('register');
    }
    setStep('code');
  });

  const verifyCode = () => run(async () => {
    if (mode === 'login') {
      const { data } = await authAPI.verifyOtpLogin(phone, code);
      await startSession(data.data.accessToken);
      return;
    }
    const { data } = await authAPI.verifyOtpRegister(phone, code);
    setVerificationToken(data.data.verificationToken);
    setStep('name');
  });

  const completeSignUp = () => run(async () => {
    const { data } = await authAPI.completeRegistration({
      verificationToken,
      fullName: fullName.trim(),
      role: 'CUSTOMER',
    });
    await startSession(data.data.accessToken);
  });

  return (
    <div className="min-h-screen bg-accent flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-primary tracking-tighter">ET SPARK</h1>
          <p className="text-primary font-bold text-xs mt-1">CUSTOMER ACCOUNT</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-sm text-red-700">⚠ {error}</div>
          )}

          {step === 'phone' && (
            <form onSubmit={(e) => { e.preventDefault(); requestCode(); }}>
              <h2 className="text-2xl font-bold text-primary-900 text-center mb-2">Sign in with your phone</h2>
              <p className="text-sm text-gray-500 text-center mb-6">We'll send you a code. New here? We'll set up your account.</p>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone</label>
              <input
                type="tel"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 9XX XXX XXX"
                required
              />
              <button type="submit" disabled={busy} className="w-full bg-primary text-accent font-bold py-3 rounded-xl disabled:opacity-50">
                {busy ? 'Sending…' : 'Send code'}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={(e) => { e.preventDefault(); verifyCode(); }}>
              <h2 className="text-2xl font-bold text-primary-900 text-center mb-2">Enter your code</h2>
              <p className="text-sm text-gray-500 text-center mb-6">Sent to {phone}</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-5 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
              <button type="submit" disabled={busy} className="w-full bg-primary text-accent font-bold py-3 rounded-xl disabled:opacity-50">
                {busy ? 'Checking…' : 'Verify'}
              </button>
            </form>
          )}

          {step === 'name' && (
            <form onSubmit={(e) => { e.preventDefault(); completeSignUp(); }}>
              <h2 className="text-2xl font-bold text-primary-900 text-center mb-6">What's your name?</h2>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                required
              />
              <button type="submit" disabled={busy || !fullName.trim()} className="w-full bg-primary text-accent font-bold py-3 rounded-xl disabled:opacity-50">
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
