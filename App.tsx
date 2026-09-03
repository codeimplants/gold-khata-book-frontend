import React, {
  Component,
  ErrorInfo,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  BackHandler,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GluestackUIProvider, createConfig } from '@gluestack-ui/themed';
import { config as defaultConfig } from '@gluestack-ui/config';

import {
  NavigationContainer,
  NavigationContainerRef,
  CommonActions,
} from '@react-navigation/native';
import { Provider } from 'react-redux';

import { NetworkProvider, useNetwork } from '@codeimplants/app-network';
import { VCDecision } from '@codeimplants/version-control';
import { SupportProvider } from '@codeimplants/support';
import { AppReview } from '@codeimplants/app-review';
import * as AnalyticsSDK from '@codeimplants/analytics';
import {
  SystemMaintenanceScreen,
  UpdateModal,
  NetworkOfflineScreen,
  NetworkSlowConnectionScreen,
  ErrorBoundaryScreen,
  initializeUIKit,
} from '@codeimplants/ui-kit';

import { APP_ENV, APP_VERSION, ANALYTICS_ENABLED } from '@env';
import { appCore } from './src/appCore';
import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { getDecision } from './src/utils/sdk';
import {
  clearPlatformUser,
  initPlatformAnalytics,
  setPlatformUser,
} from './src/utils/platformAnalytics';
import { supportConfig, buildSupportProp } from './src/constants/support';
import { getVersionName } from './src/utils/appVersion';
import { LanguageProvider } from './src/context/LanguageProvider';
import { setNexusFeatureFlags } from './src/store/config/configSlice';
import { readNexusFeatureFlags } from './src/featureFlags/registry';
import GlobalSupportButton from './src/components/common/GlobalSupportButton';

const { Analytics } = AnalyticsSDK;
const analyticsEnvironment =
  (APP_ENV as 'local' | 'dev' | 'qa' | 'prod') ?? 'local';

Analytics.init({
  appName: 'gold-khata-book',
  environment: analyticsEnvironment,
  // Read from the installed binary. APP_VERSION is a hardcoded '0.0.1' in every
  // env config, and the GA4 adapter stamps this onto the app_version param of
  // every single event — so leaving it made the whole install base look like one
  // version and made "who is still on an old build?" unanswerable.
  appVersion: getVersionName() || APP_VERSION || '0.0.1',
  enableAnalytics:
    ANALYTICS_ENABLED !== false && analyticsEnvironment !== 'local',
});

// The ui-kit was never initialised, so it fell back to its built-in default and
// stamped "App Version: 1.0.0" on every error report a user sends to support
// over WhatsApp — the one place a wrong version actively misleads a human who
// is trying to reproduce a bug.
initializeUIKit({ appVersion: getVersionName() || APP_VERSION || '0.0.1' });

// Rating prompts. No-ops on web, where there is no store to review in.
//
// A backend `storeUrl` still wins over `ios.appStoreId` (see the effect below), so
// the link stays changeable from Nexus. The id is declared anyway because the backend
// sends storeUrl for android only — on iOS there was nothing to fall back to, so the
// rating prompt had no store to open.
AppReview.init({
  android: { packageName: 'com.goldkhatabook.app' },
  ios: { appStoreId: APP_STORE_ID },
  onEvent: (name, props) => {
    // Milestones fire on every saved bill and order, which would shadow
    // INVOICE_CREATED / ADVANCE_ORDER_CREATED one-for-one and add no insight — the
    // counter is only ever read locally. The rest are rare and worth having in GA4.
    if (name === 'REVIEW_MILESTONE_RECORDED') return;
    Analytics.track(name, props ?? {});
  },
});

// No-ops when ONESIGNAL_APP_ID is unset or on the simulator. Initialising here
// rather than in an effect means the SDK is ready before the first render, so a
// notification tapped from a cold start is not dropped.
initPush();

const customConfig = createConfig({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    fonts: {
      ...defaultConfig.tokens?.fonts,
      heading: 'SpaceGrotesk',
      body: 'Outfit',
      mono: 'Outfit',
    },
  },
});

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorDetails: string | null;
}

class AppErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorDetails: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorDetails: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    appCore.reportCrash({
      message: error.message,
      stack: error.stack,
      component: errorInfo.componentStack ?? undefined,
    });
    this.setState({ errorDetails: errorInfo.componentStack ?? null });
  }

  handleReset = () => {
    appCore.resetErrorState();
    this.setState({ hasError: false, error: null, errorDetails: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryScreen
          onReset={this.handleReset}
          support={buildSupportProp('App Crash', {
            errorMessage: this.state.error?.message,
          })}
        />
      );
    }
    return this.props.children;
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const NAVIGATION_PERSISTENCE_KEY = '@navigation_state_v1';

import { abortAllPendingRequests } from './src/api/apiClient';

import BrandLoader from './src/components/common/BrandLoader';

import { resetGlobalLoading } from './src/store/ui/uiSlice';
import { hydrateAuth, hydrateDeviceRegistration } from './src/store/auth/authSlice';
import { hydrateSecurity, activateLock, setBiometricLockEnabled, setBiometricPromptSeen } from './src/store/security/securitySlice';
import { hydratePrintPrefs } from './src/store/printPrefs/printPrefsSlice';
import { isBiometricPromptInFlight } from './src/utils/biometricPromptState';
import { fetchPlatformConfig } from './src/store/config/configSlice';
import { useAppDispatch, useAppSelector } from './src/store/hooks';
import BiometricLockScreen from './src/screens/security/BiometricLockScreen';
import BiometricsEnableModal from './src/components/BiometricsEnableModal';
import { ToastViewport } from './src/components/common/Toast';
import { ApiErrorHost } from './src/components/common/ApiErrorHost';
import { useBiometric } from './src/hooks/useBiometric';
import { useImpersonationDeepLink } from './src/hooks/useImpersonationDeepLink';
import { isIOSSimulator } from './src/utils/deviceInfo';
import { getUserIdFromToken, isAdminToken } from './src/utils/authToken';
import { initPush, setPushUser, clearPushUser } from './src/services/push';
import { APP_STORE_ID, resolveStoreUrl } from './src/config/storeLinks';
import PublicDocumentPage, { getPublicRoute } from './src/web/publicRoutes';

// Gold Khata Book's brand applied to the kit's default update card. The violet is the
// dashboard header's own gradient, so the sheet reads as part of this app rather
// than as generic chrome — which is what these props exist for.
const UPDATE_ACCENT = '#6D5EF7';
const UPDATE_HERO = ['#6D5EF7', '#A855F7'];

/**
 * The browser tab title on the web build.
 *
 * React Navigation's default is the raw route name, so a shopkeeper with three
 * tabs open was choosing between "OrderDetails", "CustomerDetails" and
 * "SoldToUsDetails". Splitting the camel case gives a readable title for every
 * screen at once, rather than needing a `title` option remembered on each new
 * one.
 *
 * A screen that sets its own `title` still wins — the split cannot know that
 * "SoldToUs" is meant to read "Sold to Us" rather than "Sold To Us".
 *
 * Native has no document to title; React Navigation only calls this on web.
 */
const webDocumentTitle = (
  options: Record<string, any> | undefined,
  route: { name?: string } | undefined,
): string => {
  if (options?.title) return options.title;
  const name = route?.name || '';
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
};

function AppContent() {
  const isWeb = Platform.OS === 'web';
  const dispatch = useAppDispatch();
  const { isOnline, isUnstable, latency } = useNetwork();
  const navigationRef = useRef<NavigationContainerRef<any> | null>(null);
  const appState = useRef(AppState.currentState);
  // Whether the app genuinely reached `background` since the last resume — see
  // the biometric lock note in the AppState listener below.
  const hasBackgrounded = useRef(false);

  const { hydrated, isLoggedIn, isGuest, userType, impersonateUserId, token, needsRegistration, registrationSkipped } = useAppSelector(s => s.auth);
  const { isLockActive, biometricPromptSeen, hydrated: securityHydrated } = useAppSelector(s => s.security);
  const isAuthenticated = useAppSelector(s => s.auth.isLoggedIn || s.auth.isGuest);

  // Nexus hands a shop over as ?impersonate=<id> on the web build. No-op
  // everywhere else, and on web until a signed-in admin is present.
  useImpersonationDeepLink();

  const { checkAvailability, prompt } = useBiometric();
  const [enrollingBiometrics, setEnrollingBiometrics] = useState(false);
  const [initialNavigationState, setInitialNavigationState] = useState<any>();
  const [isReady, setIsReady] = useState(false);
  const [decision, setDecision] = useState<VCDecision | null>(null);
  const [decisionLoaded, setDecisionLoaded] = useState<boolean>(isWeb);
  const [storeUrl, setStoreUrl] = useState<string>('');
  const [force, setForce] = useState<boolean>(false);
  const [soft, setSoft] = useState<boolean>(false);
  const [killSwitch, setKillSwitch] = useState<boolean>(false);
  const [maintenance, setMaintenance] = useState<boolean>(false);
  const [slowDismissed, setSlowDismissed] = useState<boolean>(false);
  const [currentRouteName, setCurrentRouteName] = useState<string>();

  const isDarkMode = useColorScheme() === 'dark';

  // 1. Dispatch hydration on initial mount
  useEffect(() => {
    dispatch(hydrateAuth());
    dispatch(hydrateDeviceRegistration());
    dispatch(hydrateSecurity());
    dispatch(hydratePrintPrefs());
    dispatch(fetchPlatformConfig());

        // Inject global CSS for web to hide focus outlines
    if (Platform.OS === 'web') {
      try {
        const style = document.createElement('style');
        style.textContent = `
          *:focus, *:focus-visible, *:active {
            outline: none !important;
            box-shadow: none !important;
          }
          input, select, textarea, button, [role="button"], [data-gluestack-component] {
            outline: none !important;
            box-shadow: none !important;
            font-family: "Outfit", sans-serif !important;
          }
          input::placeholder, textarea::placeholder {
            font-family: "Outfit", sans-serif !important;
          }
          /* Fix for Gluestack Select height on web */
          [data-gluestack-component="SelectInput"] {
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
          }
        `;
        document.head.appendChild(style);
      } catch (e) {
        console.warn('Failed to inject global styles:', e);
      }
    }
  }, [dispatch]);

  // If the device has no biometric hardware at all, silently mark the one-time
  // enable prompt as seen so it never renders a dead-end modal.
  useEffect(() => {
    if (isWeb || !isAuthenticated || !securityHydrated || biometricPromptSeen) return;
    checkAvailability().then(info => {
      if (!info.available) {
        dispatch(setBiometricPromptSeen(true));
      }
    });
  }, [isWeb, isAuthenticated, securityHydrated, biometricPromptSeen]);

  // Lock on cold start, not just on resume from background. A session restored
  // from storage must pass biometrics before any of its data is on screen —
  // otherwise the lock is trivially bypassed by force-quitting and reopening,
  // and it would not match the fingerprint-on-launch behaviour users expect.
  //
  // Fires once per launch, gated on both slices being hydrated so it sees the
  // restored session rather than the empty initial state. The once-per-launch
  // ref matters: without it, enabling the toggle in Settings would immediately
  // lock the user out of the screen they are standing on.
  const coldStartLockChecked = useRef(false);
  useEffect(() => {
    if (isWeb || coldStartLockChecked.current) return;
    if (!hydrated || !securityHydrated) return;
    coldStartLockChecked.current = true;
    const sec = store.getState().security;
    const auth = store.getState().auth;
    if (sec.biometricLockEnabled && (auth.isLoggedIn || auth.isGuest)) {
      dispatch(activateLock());
    }
  }, [isWeb, hydrated, securityHydrated, dispatch]);

  const showBiometricsPrompt =
    !isWeb && isAuthenticated && securityHydrated && !biometricPromptSeen && !isLockActive;

  const handleEnableBiometrics = async () => {
    if (enrollingBiometrics) return;
    setEnrollingBiometrics(true);
    try {
      const info = await checkAvailability();
      if (!info.available) return;
      const result = await prompt('Confirm to enable biometric lock');
      if (result.success) {
        dispatch(setBiometricLockEnabled(true));
      }
    } finally {
      dispatch(setBiometricPromptSeen(true));
      setEnrollingBiometrics(false);
    }
  };

  const handleSkipBiometrics = () => {
    dispatch(setBiometricPromptSeen(true));
  };

  // Force-navigate away from Login/Otp the moment auth state flips to
  // authenticated (real login or guest). RootNavigator swaps its entire
  // screen list based on isAuthenticated but keeps the same Stack.Navigator
  // instance mounted, so its `initialRouteName` prop is only honored on the
  // very first mount — it does NOT re-apply on this transition. Without an
  // explicit reset here, React Navigation falls back to whichever
  // authenticated screen is listed first in RootNavigator (CompleteRegistration),
  // not MainTabs, stranding guests (and any already-registered user) on the
  // registration screen.
  const wasAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = isAuthenticated;
    if (!navigationRef.current || !isAuthenticated || wasAuthenticated) return;
    // Mirrors RootNavigator: a user who chose "Skip for now" must not be sent
    // back to the form by this reset either.
    const registrationPending = isLoggedIn && !isGuest && needsRegistration && !registrationSkipped;
    const target =
      userType === 'admin' && !impersonateUserId
        ? 'AdminDashboard'
        : registrationPending
          ? 'CompleteRegistration'
          : 'MainTabs';
    navigationRef.current.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: target }] })
    );
  }, [isAuthenticated, isLoggedIn, isGuest, userType, impersonateUserId, needsRegistration, registrationSkipped]);

  // Send an admin back to the picker after login, and when impersonation ends.
  //
  // The reset is unavoidable — the admin has to be pulled off a shop's own
  // screens. It used to rebuild a two-deep stack so Back returned to the shop
  // detail screen an impersonation was started from; AdminHome is a flat picker
  // with nothing to go back to, so a single route is the whole destination.
  useEffect(() => {
    if (!navigationRef.current) return;
    if (isLoggedIn && userType === 'admin' && !impersonateUserId) {
      if (navigationRef.current.getCurrentRoute()?.name !== 'AdminHome') {
        navigationRef.current.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'AdminHome' }] })
        );
      }
    }
  }, [isLoggedIn, userType, impersonateUserId]);

  // Navigate non-admin (or impersonating admin) away from AdminHome
  useEffect(() => {
    if (!navigationRef.current) return;
    const shouldBeOnAdminHome = isLoggedIn && userType === 'admin' && !impersonateUserId;
    if (isAuthenticated && !shouldBeOnAdminHome) {
      if (navigationRef.current.getCurrentRoute()?.name === 'AdminHome') {
        navigationRef.current.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
        );
      }
    }
  }, [isAuthenticated, isLoggedIn, userType, impersonateUserId]);

  // 2. Restore navigation state on startup
  useEffect(() => {
    const restoreState = async () => {
      try {
        const savedStateString = await AsyncStorage.getItem(NAVIGATION_PERSISTENCE_KEY);
        const state = savedStateString ? JSON.parse(savedStateString) : undefined;
        if (state) setInitialNavigationState(state);
      } catch (e) {
        console.error('[App] Failed to restore navigation state:', e);
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) restoreState();
  }, [isReady]);

  useEffect(() => {
    appCore.updateConnectivity(isOnline);
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) {
      Analytics.track('OFFLINE_DETECTED');
    }
  }, [isOnline]);

  /**
   * Keeps the analytics user id in sync with auth state.
   *
   * Single source of truth for analytics identity — covers login, session
   * restore and logout together. Previously OtpScreen set it on login only, so
   * restored sessions had no id and, worse, nothing ever cleared it: the
   * previous user's id survived logout into the next account on a shared device.
   *
   * The id is the server's opaque ObjectId from the JWT, never the phone number,
   * which Firebase prohibits as PII. If the token cannot be decoded (the offline
   * dev path issues 'dummy-token') no id is set rather than falling back.
   *
   * While impersonating, no id is set at all — the JWT's sub is the admin's, so
   * attributing the shopkeeper's activity to it would corrupt both profiles.
   */
  useEffect(() => {
    // Admins are excluded for the same reason impersonation is, and the gap
    // between the two was only ever an oversight: while impersonating, the JWT's
    // sub is the admin's, but so it is when an admin is merely signed in and has
    // not picked a shop yet. That window was tracked, and it produced exactly the
    // corruption the impersonation guard exists to prevent — an admin ObjectId
    // reported as an app user, showing in Nexus as "Not in Gold Khata Book" with no name
    // and no phone, because it is an Admin record and the platform resolves
    // against Dukandar records. It also inflated the user count and dragged every
    // engagement average, since a day at a desk in the web app dwarfs a
    // shopkeeper's minutes on a handset.
    if (!isLoggedIn || impersonateUserId || isAdminToken(token)) {
      Analytics.clearUser();
      clearPlatformUser();
      return;
    }
    const userId = getUserIdFromToken(token);
    if (userId) {
      Analytics.setUser(userId);
      // Same opaque id as Firebase: the admin platform stays pseudonymous and
      // resolves the phone from this app's own backend only when needed.
      void setPlatformUser(userId, 'otp');
    } else {
      Analytics.clearUser();
      clearPlatformUser();
    }
  }, [isLoggedIn, token, impersonateUserId]);

  /**
   * Engagement telemetry to the admin platform (device registration, session
   * open/close, app-open counts). Independent of auth: an install that never
   * logs in still counts toward installed devices.
   */
  useEffect(() => {
    void initPlatformAnalytics();
  }, []);

  /**
   * Push identity, bound to the same id as analytics above.
   *
   * Impersonation is excluded for a stronger reason here than for analytics:
   * binding the admin's device to a shopkeeper's id would deliver that shop's
   * outstanding balances to the admin's phone, and keep doing so after the
   * impersonation session ended.
   *
   * No permission is requested here — see requestPermission() in
   * src/services/push.ts for why that must happen at a deliberate moment.
   */
  useEffect(() => {
    if (!isLoggedIn || impersonateUserId) {
      clearPushUser();
      return;
    }
    const userId = getUserIdFromToken(token);
    if (userId) {
      setPushUser(userId);
    } else {
      clearPushUser();
    }
  }, [isLoggedIn, token, impersonateUserId]);

  useEffect(() => {
    if (!isUnstable) setSlowDismissed(false);
  }, [isUnstable]);

  useEffect(() => {
    appCore.onInit();
    const sub = AppState.addEventListener('change', (nextAppState) => {
      // Presenting the native Face ID sheet itself causes a transient
      // active -> inactive -> active blip (Touch ID/fingerprint resolve
      // near-instantly and rarely trigger this). Treating that blip as a
      // real backgrounding re-activates the lock mid-prompt, which then
      // re-triggers the biometric prompt and loops — so ignore AppState
      // transitions entirely while a prompt is in flight.
      if (isBiometricPromptInFlight()) {
        // Still record a genuine backgrounding: the user can swipe home while the
        // sheet is up, and that must re-lock on return rather than being swallowed.
        if (nextAppState === 'background') {
          hasBackgrounded.current = true;
        }
        appState.current = nextAppState;
        return;
      }
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[App] App has come to the foreground');
        appCore.onResume();
        store.dispatch(resetGlobalLoading()); // Failsafe: Reset stuck loaders on resume
        // Refresh critical data on resume (silent=true to avoid unmounting app)
        fetchDecision(true);
        // Activate biometric lock if enabled and user is authenticated.
        //
        // Gated on a *real* backgrounding, not merely `inactive`. Presenting the
        // Face ID / passcode sheet drives the app active -> inactive -> active and
        // never reaches `background`, so treating `inactive` as a resume re-locked
        // the app the moment the sheet was dismissed, which remounted the lock
        // screen and re-prompted forever. Anything that genuinely hands the app
        // away — home swipe, app switcher, screen off — always passes through
        // `background`, so this still locks when it matters. The in-flight flag
        // above is kept as a first line of defence, but it cannot be relied on
        // alone: the trailing `active` fires when the sheet's dismissal animation
        // ends, which can land after the auth promise has already resolved.
        const sec = store.getState().security;
        const auth = store.getState().auth;
        if (
          hasBackgrounded.current &&
          sec.biometricLockEnabled &&
          (auth.isLoggedIn || auth.isGuest)
        ) {
          store.dispatch(activateLock());
        }
        hasBackgrounded.current = false;
      } else if (nextAppState.match(/inactive|background/)) {
        if (nextAppState === 'background') {
          hasBackgrounded.current = true;
        }
        console.log('[App] App is going to background');
        appCore.onPause();
        // Abort all pending requests to prevent background leaks and crashes on resume
        abortAllPendingRequests();
      }
      appState.current = nextAppState;
    });
    return () => {
      sub.remove();
      appCore.destroy();
    };
  }, []);

  useEffect(() => {
    if (!isWeb) {
      fetchDecision();
    }
  }, [isWeb]);

  const fetchDecision = (silent = false) => {
    if (!silent) setDecisionLoaded(false);

    const timeout = new Promise<null>(resolve =>
      setTimeout(() => resolve(null), isWeb ? 1200 : 5000),
    );

    Promise.race([getDecision(), timeout])
      .then((d: VCDecision | null) => {
        if (d) {
          setDecision(d);
          // Nexus can force a feature flag off. Read from `raw`, which the SDK
          // sets to the whole backend response — so once Nexus starts serving
          // `featureFlags`, builds already in the stores honour it with no app
          // release and no SDK release.
          //
          // Only dispatched when a decision actually arrived. A timeout or an
          // error leaves the map empty, which forces nothing off: flags fail
          // open, and an unreachable Nexus must never remove working features.
          dispatch(setNexusFeatureFlags(readNexusFeatureFlags(d.raw)));
        }
      })
      .catch(() => {
        // If the SDK call errors, just proceed normally
      })
      .finally(() => setDecisionLoaded(true));
  };

  useEffect(() => {
    if (!decision) return;

    // AppReview is configured at init from our own ios.appStoreId / android
    // packageName and deliberately not re-pointed at decision.storeUrl here: the
    // listing link is ours to know, and depending on the backend for it is what
    // left "Rate this app" with nothing to open on iOS.

    // Set unconditionally rather than only when the backend supplied a value —
    // leaving it at '' is what made the Update button do nothing on every iPhone.
    setStoreUrl(resolveStoreUrl(decision.storeUrl));

    setForce(false);
    setSoft(false);
    setMaintenance(false);
    setKillSwitch(false);

    if (decision.action === 'FORCE_UPDATE') {
      setForce(true);
    } else if (decision.action === 'SOFT_UPDATE') {
      setSoft(true);
    } else if (decision.action === 'MAINTENANCE') {
      setMaintenance(true);
    } else if (decision.action === 'KILL_SWITCH') {
      setKillSwitch(true);
    }
  }, [decision]);

  const handleForceUpdate = () => {
    if (storeUrl) Linking.openURL(storeUrl);
    setTimeout(() => BackHandler.exitApp(), 1500);
  };

  const handleSoftUpdate = () => {
    if (storeUrl) Linking.openURL(storeUrl);
  };

  // Wait for EVERYTHING: Navigation restored, Auth hydrated, Security hydrated, and Decision loaded.
  if ((!isWeb && !decisionLoaded) || !isReady || !hydrated || (!isWeb && !securityHydrated)) {
    return <BrandLoader />;
  }

  if (!isWeb && (force || killSwitch)) {
    // Same card as the soft update, minus onSkip — which is what removes the
    // close control and makes Android's back button refuse to dismiss it. It
    // still returns early rather than overlaying the app: a blocked user should
    // not be looking at a dashboard they cannot use.
    return (
      <View style={styles.blockingBackdrop}>
        <UpdateModal
          visible
          title={decision?.raw?.title || 'Update required'}
          description={
            decision?.message ||
            'This version is no longer supported. Update to carry on using Gold Khata Book.'
          }
          updateButtonText={decision?.raw?.buttonText || 'Update Now'}
          onUpdate={handleForceUpdate}
          primaryColor={UPDATE_ACCENT}
          heroColors={UPDATE_HERO}
          support={buildSupportProp('Force Update')}
        />
      </View>
    );
  }

  if (!isWeb && maintenance) {
    return (
      <SystemMaintenanceScreen
        support={buildSupportProp('System Maintenance')}
      />
    );
  }

  // The iOS Simulator's network stack frequently reports "unknown" connectivity
  // even when the host is online, and the connectivity adapter treats unknown as
  // offline — which locks the whole app behind this gate and makes the Simulator
  // unusable for testing. Real devices are unaffected: isIOSSimulator is false
  // there, so the gate behaves exactly as before.
  if (!isOnline && !isIOSSimulator) {
    return (
      <NetworkOfflineScreen
        onRetry={() => fetchDecision(isWeb)}
        tips={[
          'Check your Wi-Fi or mobile data settings',
          'Try turning airplane mode on and off',
          'Move closer to your router or access point',
          'Restart the app if the problem persists',
          'Check your internet connection and try again',
        ]}
        support={buildSupportProp('Network Offline')}
      />
    );
  }

  if (isUnstable && !slowDismissed) {
    return (
      <NetworkSlowConnectionScreen
        onContinue={() => setSlowDismissed(true)}
        support={buildSupportProp('Slow Connection')}
      />
    );
  }

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {(isWeb || (!soft && !force && !maintenance)) && (
        <NavigationContainer
          ref={navigationRef}
          documentTitle={{ formatter: webDocumentTitle }}
          initialState={
            // Admin without impersonation must always land on AdminDashboard.
            // Passing persisted state here can place them on MainTabs (e.g. from
            // a previous impersonation session), and the post-mount reset fires
            // before the navigator is ready, so we skip restoration entirely.
            isLoggedIn && userType === 'admin' && !impersonateUserId
              ? undefined
              : initialNavigationState
          }
          onStateChange={(state) => {
            AsyncStorage.setItem(NAVIGATION_PERSISTENCE_KEY, JSON.stringify(state));
            const route = navigationRef.current?.getCurrentRoute();
            if (route?.name) {
              Analytics.screen(route.name);
              setCurrentRouteName(route.name);
            }
          }}
          onReady={() => {
            const route = navigationRef.current?.getCurrentRoute();
            if (route?.name) {
              Analytics.screen(route.name);
              setCurrentRouteName(route.name);
            }
          }}>
          <RootNavigator />
        </NavigationContainer>
      )}
      {isWeb || (!soft && !force && !maintenance) ? (
        <GlobalSupportButton
          currentRouteName={currentRouteName}
          // The button lives outside NavigationContainer, so it cannot use
          // useNavigation() — hand it the ref-backed navigate instead.
          onNavigate={(screen, params) =>
            navigationRef.current?.dispatch(CommonActions.navigate(screen, params))
          }
        />
      ) : null}
      {!isWeb && (
        <UpdateModal
          visible={soft}
          title={decision?.raw?.title}
          description={decision?.message}
          // The backend words this ("Update"), so it stays translatable from
          // Nexus rather than being frozen into the build.
          updateButtonText={decision?.raw?.buttonText}
          onUpdate={handleSoftUpdate}
          onSkip={() => setSoft(false)}
          primaryColor={UPDATE_ACCENT}
          heroColors={UPDATE_HERO}
          // The same contacts the forced version offers, and arguably the more
          // useful of the two: a forced update leaves no choice but to take it,
          // whereas someone who can still skip is exactly the person who wants to
          // ask whether they have to. `Soft Update` has been in the SupportScreen
          // union with its own reason line since support was added here — only
          // the prop was missing, so a report from this screen was impossible
          // even though the wiring for it already existed.
          support={buildSupportProp('Soft Update')}
        />
      )}
      {!isWeb && isLockActive && isAuthenticated && <BiometricLockScreen />}
      {showBiometricsPrompt && (
        <BiometricsEnableModal
          visible={showBiometricsPrompt}
          onEnable={handleEnableBiometrics}
          onSkip={handleSkipBiometrics}
          loading={enrollingBiometrics}
        />
      )}
      <ToastViewport />
      <ApiErrorHost />
    </>
  );
}

function AppFrame({ children }: { children: ReactNode }) {
  const isWeb = Platform.OS === 'web';

  if (!isWeb) {
    return <>{children}</>;
  }

  return (
    <View style={styles.webViewport}>
      <View style={styles.webFrame}>
        {children}
      </View>
    </View>
  );
}

export default function App() {
  // /privacy-policy, /terms-and-conditions and /account-deletion are public
  // store-compliance URLs and must render for a signed-out visitor. They are
  // resolved here, ahead of AppContent, so they bypass auth gating, the
  // offline/maintenance gates and the persisted navigation state — see
  // src/web/publicRoutes.tsx. Always null on native.
  const publicRoute = getPublicRoute();

  return (
    <SafeAreaProvider>
      <AppFrame>
        <SupportProvider config={supportConfig}>
          <NetworkProvider
            instabilityConfig={{
              pingInterval: 5000,
              threshold: 1500,
            }}>
            <GluestackUIProvider config={customConfig}>
              <AppErrorBoundary>
                {/* Store outside LanguageProvider, not inside. The shop's bill
                    template and languages are stored on the shop record so two
                    computers agree, and LanguageProvider has to read them off
                    redux to adopt them — which it can only do from inside the
                    Provider. Nothing sat between these two, so the swap changes
                    nothing else: both contexts still wrap the whole app. */}
                <Provider store={store}>
                  <LanguageProvider>
                    {publicRoute ? (
                      <PublicDocumentPage id={publicRoute} />
                    ) : (
                      <AppContent />
                    )}
                  </LanguageProvider>
                </Provider>
              </AppErrorBoundary>
            </GluestackUIProvider>
          </NetworkProvider>
        </SupportProvider>
      </AppFrame>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webViewport: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: '#F3F4F6', // Light gray background for the "outside" area
  },
  webFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent', // Allow headers/tabs to show their own backgrounds
  },
  // Plain app-background fill behind the blocking update card, so the modal has
  // something to sit on once the navigator is no longer rendered.
  blockingBackdrop: { flex: 1, backgroundColor: '#F3F4F6' },
});
