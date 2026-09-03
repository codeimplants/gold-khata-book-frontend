import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer, { loginAsGuest, logout, setPhone, verifyOtp, requestOtp, resetOtpState, startImpersonation, endImpersonation, completeRegistration, skipRegistration } from './auth/authSlice';
import dataReducer from './data/dataSlice';
import uiReducer from './ui/uiSlice';
import securityReducer, { setBiometricLockEnabled, setBiometricPromptSeen } from './security/securitySlice';
import configReducer from './config/configSlice';
import printPrefsReducer, { setPrintMode, setThermalDevice, markPrinterChosen, setPaperPrefs, PRINT_PREFS_KEY } from './printPrefs/printPrefsSlice';
import type { PaperPrefs } from '../constants/bill';
import { injectStore } from '../api/apiClient';

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
      .prepend(deviceRegistrationPersistenceListener.middleware)
      .prepend(securityPersistenceListener.middleware)
      .prepend(printPrefsPersistenceListener.middleware),
});

// Inject store into apiClient to solve circular dependency and ensure instant loader dismissal
injectStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
