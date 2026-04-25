import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import api from '../services/api';

export const loadUser = createAsyncThunk('auth/loadUser', async (_, { rejectWithValue }) => {
  try {
    if (!auth.currentUser) return null;
    const { data } = await api.get('/auth/me');
    return data.data;
  } catch {
    return rejectWithValue(null);
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try { await signOut(auth); } catch {}
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    driver: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    setAuthState: (state, action) => {
      if (!action.payload.signedIn) {
        state.user = null;
        state.driver = null;
        state.isAuthenticated = false;
        state.isLoading = false;
      }
    },
    updateDriver: (state, action) => { state.driver = { ...state.driver, ...action.payload }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUser.pending, (state) => { state.isLoading = true; })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.isAuthenticated = true;
          state.user = action.payload;
          state.driver = action.payload.driver;
        } else {
          state.isAuthenticated = false;
        }
      })
      .addCase(loadUser.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.driver = null;
        state.isAuthenticated = false;
        state.isLoading = false;
      });
  },
});

export const { clearError, setAuthState, updateDriver } = authSlice.actions;
export default authSlice.reducer;
