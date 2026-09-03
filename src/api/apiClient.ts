import { ApiClient, AuthInterceptor, Logger, ContentTypeInterceptor } from '@codeimplants/app-core';
import { API_BASE_URL } from '@config';
import { startGlobalLoading, stopGlobalLoading, resetGlobalLoading } from '../store/ui/uiSlice';

const logger = new Logger('Api');

const apiClient = new ApiClient(
  {
    baseURL: (API_BASE_URL || '').replace(/\/api\/?$/, '').replace(/\/$/, '') + '/',
    timeout: 30000,
  },
  logger,
);

const ongoingRequests = new Map<string, AbortController>();
const activeControllers = new Set<AbortController>();

// Store reference for zero-latency loader dismissal
let _store: any = null;
export const injectStore = (store: any) => {
  _store = store;
};

// Interceptor for Global Loader and Request Deduplication
// This is added FIRST to ensure it wraps all subsequent interceptors and catches all results/errors
apiClient.addInterceptor({
  onRequest: async (config: any) => {
    const method = config.method?.toLowerCase();
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(method);
    const url = config.url;
    const requestId = `${method}:${url}`;

    if (isMutation && _store) {
      console.log(`[ApiClient] Starting mutation: ${requestId}`);
      // 1. Trigger Global Loader and tag the config
      _store.dispatch(startGlobalLoading());
      config.metadata = { ...config.metadata, _globalLoadingStarted: true };
      
      // Add a custom header as a fallback for error matching if the config object is cloned/lost
      config.headers = { ...config.headers, 'x-mutation-request': requestId };

      // 2. Request Cancellation (Deduplication)
      if (ongoingRequests.has(requestId)) {
        console.log(`[ApiClient] Cancelling previous mutation: ${requestId}`);
        ongoingRequests.get(requestId)?.abort();
      }
    }
    
    // Create new controller for this request
    const controller = new AbortController();
    config.signal = controller.signal;
    config.metadata = { ...config.metadata, controller }; // Store for cleanup
    
    if (isMutation) {
      ongoingRequests.set(requestId, controller);
    }
    
    activeControllers.add(controller);
    
    return config;
  },
  onResponse: async (response: any) => {
    const config = response.config;
    const method = config?.method?.toLowerCase();
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(method);
    const url = config?.url;
    const requestId = `${method}:${url}`;
    const controller = config?.metadata?.controller;

    // Guaranteed cleanup of loader for this request
    if ((config?.metadata?._globalLoadingStarted || isMutation) && _store) {
      console.log(`[ApiClient] Success: Stopping loader for: ${requestId}`);
      _store.dispatch(stopGlobalLoading());
      if (config?.metadata) config.metadata._globalLoadingStarted = false;
    }

    // Cleanup controllers
    if (controller) {
       activeControllers.delete(controller);
       if (isMutation) {
         ongoingRequests.delete(requestId);
       }
    }

    return response;
  },
  onError: async (error: any) => {
    const config = error.config || error.response?.config;
    
    // Robust search for the method and URL in various locations
    const method = (config?.method || error.response?.config?.method || error.request?.method || '').toLowerCase();
    const url = config?.url || error.response?.config?.url || error.request?.url;
    const requestId = `${method}:${url}`;
    
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(method) || !!config?.headers?.['x-mutation-request'] || !!error.response?.config?.headers?.['x-mutation-request'];
    const controller = config?.metadata?.controller;

    // CRITICAL: Stop loader first before any other error logic
    // Failsafe: if there's an error but we don't have config, stop the loader just in case
    if (!config && _store) {
      console.log(`[ApiClient] Config missing in onError - Stopping all loaders just in case`);
      _store.dispatch(stopGlobalLoading());
    } else if ((config?.metadata?._globalLoadingStarted || isMutation) && _store) {
      console.log(`[ApiClient] Error: Stopping loader for: ${requestId || 'unknown'}`);
      _store.dispatch(stopGlobalLoading());
      if (config?.metadata) config.metadata._globalLoadingStarted = false;
    }

    // Cleanup controllers
    if (controller) {
      activeControllers.delete(controller);
      if (isMutation && url) {
        const id = `${method}:${url}`;
        ongoingRequests.delete(id);
      }
    }

    if (error?.response?.status === 401 && _store) {
      const { logout } = await import('../store/auth/authSlice');
      _store.dispatch(logout());
      _store.dispatch(resetGlobalLoading()); // Reset all loaders on logout
      abortAllPendingRequests(); // Cancel everything on logout
    }
    
    // Check if it was a cancellation error
    if (error.name === 'AbortError' || error.message === 'canceled') {
      console.log(`[ApiClient] Request cancelled: ${requestId || 'unknown'}`);
    } else {
      console.error(`[ApiClient] Request failed: ${requestId || 'unknown'} - ${error.message}`);
    }

    throw error;
  },
});

apiClient.addInterceptor(
  new AuthInterceptor(async () => {
    const token = _store?.getState().auth.token;
    if (!token) return '';
    return token;
  }),
);

apiClient.addInterceptor({
  onRequest: async (config: any) => {
    const impersonateId = _store?.getState().auth.impersonateUserId;
    if (impersonateId) {
      config.headers = { ...config.headers, 'X-Impersonate-User-Id': impersonateId };
    }
    return config;
  },
});

apiClient.addInterceptor(new ContentTypeInterceptor());

/**
 * Aborts all ongoing API requests. 
 * Useful when the app goes to background or the user logs out.
 */
export const abortAllPendingRequests = () => {
  console.log(`[ApiClient] Aborting ${activeControllers.size} pending requests`);
  activeControllers.forEach(controller => controller.abort());
  activeControllers.clear();
  ongoingRequests.clear();
};

export { apiClient };
