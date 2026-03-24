import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/authSlice';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
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

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(login({ phone, password }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent rounded-2xl mb-4 shadow-lg">
            <span className="text-primary-800 font-black text-3xl">አ</span>
          </div>
          <h1 className="text-3xl font-black text-white">Abay Driver</h1>
          <p className="text-primary-200 mt-1">Ethiopia's Delivery Network • የኢትዮጵያ የማድረስ አውታር</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Sign In / ግባ</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Phone Number / ስልክ ቁጥር</label>
              <input
                type="tel"
                className="input"
                placeholder="+251 9XX XXX XXX"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); if (error) dispatch(clearError()); }}
                required
              />
            </div>

            <div>
              <label className="label">Password / የምስጢር ቃል</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) dispatch(clearError()); }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Signing in...
                </span>
              ) : 'Sign In / ግባ'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-3">Demo Credentials:</p>
            <div className="space-y-2 text-xs text-gray-600">
              <button onClick={() => { setPhone('+251922000001'); setPassword('Store@1234'); }}
                className="w-full text-left bg-gray-50 hover:bg-gray-100 p-2 rounded-lg transition-colors">
                🏪 Store: +251922000001 / Store@1234
              </button>
              <button onClick={() => { setPhone('+251911000000'); setPassword('Admin@1234'); }}
                className="w-full text-left bg-gray-50 hover:bg-gray-100 p-2 rounded-lg transition-colors">
                👑 Admin: +251911000000 / Admin@1234
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-primary-200 text-sm mt-6">🇪🇹 Made for Ethiopia</p>
      </div>
    </div>
  );
}
