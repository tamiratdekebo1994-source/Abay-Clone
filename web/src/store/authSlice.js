import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { authAPI } from '../services/api';
import { auth } from '../services/firebase';

// Persists the session so a page refresh restores the role as well as the id.
// Role-protected routes depend on it.
export function saveSession(accessToken, user) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('userId', user.uid);
  localStorage.setItem('userRole', user.role || '');
}

const FIREBASE_LOGIN_ERRORS = [
  'auth/invalid-credential',
  'auth/invalid-email',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/missing-password',
];

// Admin and store sign-in: Firebase Auth email and password, then the backend
// profile (role) for that Firebase user.
export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    const { data } = await authAPI.me();
    const user = data.data;
    if (user.role === 'CUSTOMER') {
      await signOut(auth);
      return rejectWithValue('Customers sign in with a phone code at /customer/login');
    }
    const accessToken = await auth.currentUser.getIdToken();
    saveSession(accessToken, user);
    return { accessToken, user };
  } catch (err) {
    if (FIREBASE_LOGIN_ERRORS.includes(err.code)) {
      return rejectWithValue('Invalid email or password');
    }
    if (err.code === 'auth/too-many-requests') {
      return rejectWithValue('Too many attempts. Wait a few minutes and try again.');
    }
    console.error('Login error:', err);
    const message = err.response?.data?.message || err.message || 'Network error - check your connection';
    return rejectWithValue(message);
  }
});

export const loadUser = createAsyncThunk('auth/loadUser', async (_, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    return { uid: localStorage.getItem('userId'), role: localStorage.getItem('userRole') || null };
  } catch {
    return rejectWithValue(null);
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await signOut(auth).catch(() => {});
  localStorage.removeItem('accessToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('userRole');
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, isAuthenticated: false, isLoading: true, error: null },
  reducers: {
    clearError: (state) => { state.error = null; },
    // Used after OTP sign-in, which doesn't go through the password login thunk.
    sessionStarted: (state, { payload }) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = payload.user;
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload;
      })
      .addCase(loadUser.pending, (state) => { state.isLoading = true; })
      .addCase(loadUser.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        if (payload) { state.isAuthenticated = true; state.user = payload; }
      })
      .addCase(loadUser.rejected, (state) => { state.isLoading = false; })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, sessionStarted } = authSlice.actions;
export default authSlice.reducer;
