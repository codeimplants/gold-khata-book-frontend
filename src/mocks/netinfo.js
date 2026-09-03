const listeners = new Set();

const getConnectionState = () => ({
  isConnected: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isInternetReachable: typeof navigator !== 'undefined' ? navigator.onLine : true,
});

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const state = getConnectionState();
    listeners.forEach(listener => listener(state));
  });

  window.addEventListener('offline', () => {
    const state = getConnectionState();
    listeners.forEach(listener => listener(state));
  });
}

const NetInfo = {
  addEventListener(listener) {
    listeners.add(listener);
    listener(getConnectionState());

    return () => {
      listeners.delete(listener);
    };
  },

  fetch() {
    return Promise.resolve(getConnectionState());
  },
};

module.exports = NetInfo;
module.exports.default = NetInfo;
