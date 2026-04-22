import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import { authAPI, driverAPI } from '../services/api';

export const login = createAsyncThunk('auth/login', async ({ phone, password }, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.login({ phone, password });
    await SecureStore.setItemAsync('accessToken', data.data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const loadUser = createAsyncThunk('auth/loadUser', async (_, { rejectWithValue }) => {
  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return null;
    const { data } = await authAPI.getMe();
    return data.data;
  } catch (err) {
    return rejectWithValue(null);
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  try { await authAPI.logout(refreshToken); } catch {}
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
    updateDriver: (state, action) => { state.driver = { ...state.driver, ...action.payload }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.driver = action.payload.user?.driver;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(loadUser.pending, (state) => { state.isLoading = true; })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.isAuthenticated = true;
          state.user = action.payload;
          state.driver = action.payload.driver;
        }
      })
      .addCase(loadUser.rejected, (state) => { state.isLoading = false; })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.driver = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, updateDriver } = authSlice.actions;
export default authSlice.reducer;
