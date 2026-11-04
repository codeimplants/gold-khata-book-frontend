import NetInfo from '@react-native-community/netinfo';

/**
 * Just enough connectivity for the crash reporter: queue reports while the
 * device is offline and send them when it comes back. (Sone Bill has a fuller
 * module that also probes the server; this app has none yet.)
 */
let online = true;
const listeners = new Set<() => void>();

NetInfo.addEventListener((state) => {
  online = state.isConnected !== false && state.isInternetReachable !== false;
  listeners.forEach((l) => l());
});

export const isOffline = (): boolean => !online;

export const subscribeConnectivity = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
