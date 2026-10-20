import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/authSlice';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error, user } = useSelector((s) => s.auth);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === 'ADMIN' ? '/admin' : '/store', { replace: true });
    }
  }, [isAuthenticated, user]);

  const handlePasswordLogin = (e) => {
    e.preventDefault();
    // An "@" means email; anything else is treated as a phone number.
    const value = identifier.trim();
    dispatch(login(value.includes('@') ? { email: value, password } : { phone: value, password }));
  };

  return (
    <div className="min-h-screen bg-accent flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo & Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-primary to-primary-700 rounded-3xl mb-6 shadow-2xl">
            <span className="text-accent font-black text-4xl">⚡</span>
          </div>
          <h1 className="text-5xl font-black text-primary tracking-tighter">ET SPARK</h1>
          <p className="text-primary font-bold text-sm mt-2">DELIVERY NETWORK</p>
          <p className="text-primary/60 mt-3 text-xs">Fast • Reliable • Connected</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          <div className="p-8">

            {/* Admin Login Form */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-primary-900 text-center">Sign In</h2>
              <p className="text-center text-sm text-gray-500 mt-1">Admin and store accounts</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-sm text-red-700">
                ⚠ {error}
              </div>
            )}

            <form onSubmit={handlePasswordLogin}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone or Email</label>
                <input
                  type="text"
                  autoComplete="username"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); dispatch(clearError()); }}
                  placeholder="+251 9XX XXX XXX or you@example.com"
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
              <button type="submit" className="w-full bg-accent hover:bg-accent-dark text-primary font-bold py-3.5 rounded-xl transition-colors disabled:opacity-40" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-primary/70 text-sm mt-8">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-bold hover:text-primary-700 transition-colors">Create Account</Link>
        </p>
        <p className="text-center text-primary/70 text-sm mt-3">
          Customer?{' '}
          <Link to="/customer/login" className="text-primary font-bold hover:text-primary-700 transition-colors">Sign in with a phone code</Link>
        </p>
        <p className="text-center text-primary/50 text-xs mt-3">© 2025 ET SPARK • Powering Ethiopia</p>
      </div>
    </div>
  );
}
