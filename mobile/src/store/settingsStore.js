import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = 'appLanguage';

// Reads the driver's saved language on app start, falling back to Amharic (the app default)
// if nothing has been saved yet.
export const loadLanguage = createAsyncThunk('settings/loadLanguage', async () => {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
  return saved || 'am';
});

export const changeLanguage = createAsyncThunk('settings/changeLanguage', async (lang) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  return lang;
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { theme: 'light', language: 'am' },
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadLanguage.fulfilled, (state, action) => { state.language = action.payload; })
      .addCase(changeLanguage.fulfilled, (state, action) => { state.language = action.payload; });
  },
});

export const { toggleTheme } = settingsSlice.actions;
export default settingsSlice.reducer;
