import { AppCore } from '@codeimplants/app-core';

const appCore = new AppCore({
  errorConfig: {
    maxRetries: 3,
    supportThreshold: 2,
    recoveryThreshold: 5,
  },
  featureFlags: {
    // add feature flags here as needed
  },
});

export { appCore };
