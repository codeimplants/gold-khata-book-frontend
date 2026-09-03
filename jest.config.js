module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    // Tests run against react-native-web, which has no TurboModuleRegistry. Webpack
    // picks the `.web.ts` variant automatically; jest does not, so it is mapped here
    // rather than mocked in every test that happens to reach the print path.
    '.*/specs/NativeClassicBluetooth$': '<rootDir>/src/specs/NativeClassicBluetooth.web.ts',
  },
};
