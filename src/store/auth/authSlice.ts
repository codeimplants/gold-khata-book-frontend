import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../../services/authService';
import { getDevicePayload } from '../../utils/deviceInfo';

export type AuthState = {
  isLoggedIn: boolean;
  isGuest: boolean;
  phone: string;
  token?: string;
  hash?: string;
  sessionId?: string;
  otpRequestedAt?: number | null;
  hydrated: boolean;
  loading: boolean;
  error?: string;
  userType?: 'admin' | 'dukandar';
  impersonateUserId?: string | null;
  impersonatePhone?: string | null;
  needsRegistration: boolean;
  /** They were shown the registration form and chose "Skip for now". */
  registrationSkipped: boolean;
  hasRegisteredDevice: boolean;
};

const AUTH_STATE_KEY = '@auth_state_v1';
const HAS_REGISTERED_DEVICE_KEY = '@has_registered_device_v1';

const initialState: AuthState = {
  isLoggedIn: false,
  isGuest: false,
  phone: '',
  token: undefined,
  hash: undefined,
  sessionId: undefined,
  otpRequestedAt: null,
  hydrated: false,
  loading: false,
  error: undefined,
  userType: undefined,
  impersonateUserId: null,
  impersonatePhone: null,
  needsRegistration: false,
  registrationSkipped: false,
  hasRegisteredDevice: false,
};

export const requestOtp = createAsyncThunk(
  'login/send-otp',
  async (phone: string, { rejectWithValue }) => {
    try {
      const res = await authService.requestOtp(phone);
      return {
        phone,
        hash: (res as any).fullhash || (res as any).hash,
        sessionId: (res as any).sessionId,
        requestedAt: Date.now(),
      };
    } catch (err: any) {
      console.error('[authSlice] requestOtp error:', err);
      return rejectWithValue(err.message || 'Failed to send OTP');
    }
  }
);

const OTP_STATE_TTL_MS = 5 * 60 * 1000;

type PersistedAuthState = Pick<
  AuthState,
  'isLoggedIn' | 'isGuest' | 'phone' | 'token' | 'hash' | 'sessionId' | 'otpRequestedAt' | 'userType' | 'impersonateUserId' | 'impersonatePhone' | 'needsRegistration' | 'registrationSkipped'
>;

export const hydrateAuth = createAsyncThunk('auth/hydrate', async () => {
  const raw = await AsyncStorage.getItem(AUTH_STATE_KEY);
  if (!raw) return null as PersistedAuthState | null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAuthState>;
    if (typeof parsed !== 'object' || !parsed) return null;

    const isLoggedIn = !!parsed.isLoggedIn;
    const isGuest = !!parsed.isGuest;
    const phone = typeof parsed.phone === 'string' ? parsed.phone : '';
    const token = typeof parsed.token === 'string' ? parsed.token : undefined;
    const hash = typeof parsed.hash === 'string' ? parsed.hash : undefined;
    const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined;
    const otpRequestedAt =
      typeof parsed.otpRequestedAt === 'number' ? parsed.otpRequestedAt : null;
    const userType = parsed.userType === 'admin' || parsed.userType === 'dukandar' ? parsed.userType : undefined;
    const impersonateUserId = typeof parsed.impersonateUserId === 'string' ? parsed.impersonateUserId : null;
    const impersonatePhone = typeof parsed.impersonatePhone === 'string' ? parsed.impersonatePhone : null;
    const needsRegistration = !!parsed.needsRegistration;
    const registrationSkipped = !!parsed.registrationSkipped;

    const isOtpExpired =
      otpRequestedAt != null && Date.now() - otpRequestedAt > OTP_STATE_TTL_MS;

    // Never allow both states to be true.
    if (isLoggedIn && isGuest) return null;

    const restoredState = {
      isLoggedIn,
      isGuest,
      phone,
      token,
      hash: isOtpExpired ? undefined : hash,
      sessionId: isOtpExpired ? undefined : sessionId,
      otpRequestedAt: isOtpExpired ? null : otpRequestedAt,
      userType,
      impersonateUserId,
      impersonatePhone,
      needsRegistration,
      registrationSkipped,
    };

    // Re-validate the cached session against the backend so that a revoked
    // admin (or expired token) never gets silently restored as admin.
    if (isLoggedIn && token) {
      const validation = await authService.validateSession(token);
      if (!validation.success) {
        await AsyncStorage.removeItem(AUTH_STATE_KEY);
        return null;
      }
      if (validation.userType === 'dukandar') {
        getDevicePayload()
          .then(deviceInfo => authService.recordAppOpen(token, deviceInfo))
          .catch(() => {});
      }
      return {
        ...restoredState,
        userType: validation.userType,
        needsRegistration: validation.needsRegistration ?? needsRegistration,
      };
    }

    return restoredState;
  } catch {
    return null;
  }
});

export const hydrateDeviceRegistration = createAsyncThunk(
  'auth/hydrateDeviceRegistration',
  async () => {
    const raw = await AsyncStorage.getItem(HAS_REGISTERED_DEVICE_KEY);
    return raw === 'true';
  }
);

export const verifyOtp = createAsyncThunk(
  'login/verify-otp',
  async ({ phone, otp }: { phone: string; otp: string }, { getState, rejectWithValue }) => {
    const state = (getState() as any).auth;
    const hash = state.hash;
    const sessionId = state.sessionId;
    try {
      const deviceInfo = await getDevicePayload();
      const res = await authService.verifyOtp(phone, otp, hash, sessionId, deviceInfo);
      // If we have a success flag OR a token, consider it a login success
      if (res.success || res.token) {
        return {
          phone,
          token: res.token,
          userType: (res.userType as 'admin' | 'dukandar' | undefined) ?? 'dukandar',
          needsRegistration: !!res.needsRegistration,
        };
      }

      return rejectWithValue(res.message ?? 'Invalid OTP');
    } catch (err: any) {
      console.error('[authSlice] verifyOtp error:', err);
      return rejectWithValue(err.message ?? 'Verification failed');
    }
  }
);

const authSlice = createSlice({
  name: 'login',
  initialState,
  reducers: {
    setPhone(state, action: PayloadAction<string>) {
      state.phone = action.payload;
      state.error = undefined;
      state.hash = undefined;
      state.sessionId = undefined;
      state.otpRequestedAt = null;
    },
    loginAsGuest(state) {
      state.isGuest = true;
      state.isLoggedIn = false;
      state.token = undefined;
      state.hash = undefined;
      state.sessionId = undefined;
      state.otpRequestedAt = null;
    },
    logout(state) {
      state.isLoggedIn = false;
      state.isGuest = false;
      state.phone = '';
      state.token = undefined;
      state.hash = undefined;
      state.sessionId = undefined;
      state.otpRequestedAt = null;
      state.loading = false;
      state.error = undefined;
      state.hydrated = true;
      state.userType = undefined;
      state.impersonateUserId = null;
      state.impersonatePhone = null;
      state.needsRegistration = false;
    },
    startImpersonation(state, action: PayloadAction<{ userId: string; phone: string }>) {
      state.impersonateUserId = action.payload.userId;
      state.impersonatePhone = action.payload.phone;
    },
    endImpersonation(state) {
      state.impersonateUserId = null;
      state.impersonatePhone = null;
    },
    completeRegistration(state) {
      state.needsRegistration = false;
      state.hasRegisteredDevice = true;
      state.registrationSkipped = false;
    },
    /**
     * "Skip for now" on the registration screen.
     *
     * `needsRegistration` deliberately stays true — the shop details really are
     * missing, and the server will keep saying so on every session validate.
     * This is a separate, persisted note that the user has already been asked
     * and declined, so the router lets them through instead of dropping them
     * back on the same form at every launch, which is the trap that made them
     * close the app in the first place.
     *
     * Cleared by completeRegistration, so finishing later puts everything back
     * in the normal state.
     */
    skipRegistration(state) {
      state.registrationSkipped = true;
    },
    clearError(state) {
      state.error = undefined;
    },
    resetOtpState(state) {
      state.hash = undefined;
      state.sessionId = undefined;
      state.otpRequestedAt = null;
      state.error = undefined;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(hydrateAuth.pending, state => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(hydrateAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        if (action.payload) {
          state.isLoggedIn = action.payload.isLoggedIn;
          state.isGuest = action.payload.isGuest;
          state.phone = action.payload.phone;
          state.token = action.payload.token;
          state.hash = action.payload.hash;
          state.sessionId = action.payload.sessionId;
          state.otpRequestedAt = action.payload.otpRequestedAt ?? null;
          state.userType = action.payload.userType;
          state.impersonateUserId = action.payload.impersonateUserId ?? null;
          state.impersonatePhone = action.payload.impersonatePhone ?? null;
          state.needsRegistration = action.payload.needsRegistration ?? false;
          state.registrationSkipped = action.payload.registrationSkipped ?? false;
        }
      })
      .addCase(hydrateAuth.rejected, state => {
        state.loading = false;
        state.hydrated = true;
      })
      .addCase(hydrateDeviceRegistration.fulfilled, (state, action) => {
        if (action.payload) state.hasRegisteredDevice = true;
      })
      .addCase(requestOtp.pending, state => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(requestOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.phone = action.payload.phone;
        state.hash = action.payload.hash;
        state.sessionId = action.payload.sessionId;
        state.otpRequestedAt = action.payload.requestedAt;
      })
      .addCase(requestOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to send OTP';
        state.otpRequestedAt = null;
      })
      .addCase(verifyOtp.pending, state => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.isGuest = false;
        state.phone = action.payload.phone;
        state.token = action.payload.token;
        state.hash = undefined;
        state.sessionId = undefined;
        state.otpRequestedAt = null;
        state.userType = action.payload.userType;
        state.needsRegistration = action.payload.needsRegistration;
        if (!action.payload.needsRegistration) {
          state.hasRegisteredDevice = true;
        }

        // Admins sign in like anyone else and land on AdminHome, which is now
        // a shop picker rather than a dashboard. The old two-way modal ("Admin
        // Dashboard" or "Impersonate a user") held isLoggedIn false until it
        // was answered; with the dashboard moved to Nexus there is only one
        // path left, and a modal offering a single choice is a click for
        // nothing.
        state.isLoggedIn = true;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Invalid OTP';
      });
  },
});

export const {
  setPhone,
  logout,
  clearError,
  loginAsGuest,
  resetOtpState,

  startImpersonation,
  endImpersonation,
  completeRegistration,
  skipRegistration,
} = authSlice.actions;
export default authSlice.reducer;
