import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SecurityState = {
  biometricLockEnabled: boolean;
  biometricPromptSeen: boolean;
  isLockActive: boolean;
  hydrated: boolean;
};

const SECURITY_PREFS_KEY = '@security_prefs_v1';

const initialState: SecurityState = {
  biometricLockEnabled: false,
  biometricPromptSeen: false,
  isLockActive: false,
  hydrated: false,
};

type PersistedSecurityState = Pick<SecurityState, 'biometricLockEnabled' | 'biometricPromptSeen'>;

export const hydrateSecurity = createAsyncThunk('security/hydrate', async () => {
  const raw = await AsyncStorage.getItem(SECURITY_PREFS_KEY);
  if (!raw) return null as PersistedSecurityState | null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || !parsed) return null;
    return {
      biometricLockEnabled: !!parsed.biometricLockEnabled,
      biometricPromptSeen: !!parsed.biometricPromptSeen,
    };
  } catch {
    return null;
  }
});

const securitySlice = createSlice({
  name: 'security',
  initialState,
  reducers: {
    setBiometricLockEnabled(state, action: PayloadAction<boolean>) {
      state.biometricLockEnabled = action.payload;
    },
    setBiometricPromptSeen(state, action: PayloadAction<boolean>) {
      state.biometricPromptSeen = action.payload;
    },
    activateLock(state) {
      state.isLockActive = true;
    },
    deactivateLock(state) {
      state.isLockActive = false;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(hydrateSecurity.fulfilled, (state, action) => {
        state.hydrated = true;
        if (action.payload) {
          state.biometricLockEnabled = action.payload.biometricLockEnabled;
          state.biometricPromptSeen = action.payload.biometricPromptSeen;
        }
      })
      .addCase(hydrateSecurity.rejected, state => {
        state.hydrated = true;
      });
  },
});

export const { setBiometricLockEnabled, setBiometricPromptSeen, activateLock, deactivateLock } = securitySlice.actions;
export default securitySlice.reducer;
