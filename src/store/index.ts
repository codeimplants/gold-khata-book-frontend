import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer, { loginAsGuest, logout, setPhone, verifyOtp, requestOtp, resetOtpState, startImpersonation, endImpersonation, completeRegistration, skipRegistration } from './auth/authSlice';
import dataReducer from './data/dataSlice';
import uiReducer, { resetGlobalLoading } from './ui/uiSlice';
import securityReducer, { setBiometricLockEnabled, setBiometricPromptSeen } from './security/securitySlice';
import configReducer from './config/configSlice';
import printPrefsReducer, { setPrintMode, setThermalDevice, markPrinterChosen, setPaperPrefs, PRINT_PREFS_KEY } from './printPrefs/printPrefsSlice';
import type { PaperPrefs } from '../constants/bill';
import { injectStore, abortAllPendingRequests } from '../api/apiClient';
import { clearPerUserStorage } from './perUserStorage';

const AUTH_STATE_KEY = '@auth_state_v1';
const SECURITY_PREFS_KEY = '@security_prefs_v1';
const HAS_REGISTERED_DEVICE_KEY = '@has_registered_device_v1';

const authPersistenceListener = createListenerMiddleware();

authPersistenceListener.startListening({
  matcher: isAnyOf(
    loginAsGuest,
    logout,
    verifyOtp.fulfilled,
    requestOtp.fulfilled,
    setPhone,
    resetOtpState,
    startImpersonation,
    endImpersonation,
    completeRegistration,
    skipRegistration,
  ),
  effect: async (_, api) => {
    const state = api.getState() as {
      auth: {
        isLoggedIn: boolean;
        isGuest: boolean;
        phone: string;
        token?: string;
        hash?: string;
        sessionId?: string;
        otpRequestedAt?: number | null;
        userType?: 'admin' | 'dukandar';
        impersonateUserId?: string | null;
        impersonatePhone?: string | null;
        needsRegistration: boolean;
        registrationSkipped: boolean;
      };
    };
    const { isLoggedIn, isGuest, phone, token, hash, sessionId, otpRequestedAt, userType, impersonateUserId, impersonatePhone, needsRegistration, registrationSkipped } = state.auth;

    if (!isLoggedIn && !isGuest && !otpRequestedAt) {
      await AsyncStorage.removeItem(AUTH_STATE_KEY);
      await AsyncStorage.removeItem('@navigation_state_v1');
      return;
    }

    await AsyncStorage.setItem(
      AUTH_STATE_KEY,
      JSON.stringify({ isLoggedIn, isGuest, phone, token, hash, sessionId, otpRequestedAt, userType, impersonateUserId, impersonatePhone, needsRegistration, registrationSkipped })
    );
  },
});

// Everything a logout does besides the reducers, for every logout path: the
// Settings button, account deletion, "back to login" on the registration form,
// and the 401 handler in apiClient. Keyed on the action rather than added at
// each call site, because a missed call site is how one shop's details reached
// the next account on 2026-10-21 (see the reset in dataSlice.ts).
//   - In-flight requests are cancelled, so a response for the old account
//     cannot land in the emptied store. Only the 401 path used to do this,
//     and that path never actually ran (see apiClient.ts).
//   - The global loader is reset with them, since a cancelled request may never
//     report back to stop it.
//   - The old account's keys on disk are removed (perUserStorage.ts).
const sessionEndListener = createListenerMiddleware();

sessionEndListener.startListening({
  actionCreator: logout,
  effect: async (_, api) => {
    abortAllPendingRequests();
    api.dispatch(resetGlobalLoading());
    await clearPerUserStorage();
  },
});

// Persists a permanent "this device has completed real registration" flag.
// Unlike authPersistenceListener, this listener never deletes its key on
// logout — it must survive logout/login cycles indefinitely.
const deviceRegistrationPersistenceListener = createListenerMiddleware();

deviceRegistrationPersistenceListener.startListening({
  matcher: isAnyOf(completeRegistration, verifyOtp.fulfilled),
  effect: async (_, api) => {
    const state = api.getState() as { auth: { hasRegisteredDevice: boolean } };
    if (state.auth.hasRegisteredDevice) {
      await AsyncStorage.setItem(HAS_REGISTERED_DEVICE_KEY, 'true');
    }
  },
});

const securityPersistenceListener = createListenerMiddleware();

securityPersistenceListener.startListening({
  matcher: isAnyOf(setBiometricLockEnabled, setBiometricPromptSeen),
  effect: async (_, api) => {
    const state = api.getState() as {
      security: { biometricLockEnabled: boolean; biometricPromptSeen: boolean };
    };
    await AsyncStorage.setItem(
      SECURITY_PREFS_KEY,
      JSON.stringify({
        biometricLockEnabled: state.security.biometricLockEnabled,
        biometricPromptSeen: state.security.biometricPromptSeen,
      })
    );
  },
});

const printPrefsPersistenceListener = createListenerMiddleware();

printPrefsPersistenceListener.startListening({
  matcher: isAnyOf(setPrintMode, setThermalDevice, markPrinterChosen, setPaperPrefs),
  effect: async (_, api) => {
    const state = api.getState() as {
      printPrefs: {
        mode: 'standard' | 'thermal';
        device: unknown;
        hasChosenPrinter: boolean;
        paper: PaperPrefs;
      };
    };
    await AsyncStorage.setItem(
      PRINT_PREFS_KEY,
      JSON.stringify({
        mode: state.printPrefs.mode,
        device: state.printPrefs.device,
        hasChosenPrinter: state.printPrefs.hasChosenPrinter,
        paper: state.printPrefs.paper,
      })
    );
  },
});

export const store = configureStore({
  reducer: {
    auth: authReducer,
    data: dataReducer,
    ui: uiReducer,
    security: securityReducer,
    config: configReducer,
    printPrefs: printPrefsReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware()
      .prepend(authPersistenceListener.middleware)
      .prepend(sessionEndListener.middleware)
      .prepend(deviceRegistrationPersistenceListener.middleware)
      .prepend(securityPersistenceListener.middleware)
      .prepend(printPrefsPersistenceListener.middleware),
});

// Inject store into apiClient to solve circular dependency and ensure instant loader dismissal
injectStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
