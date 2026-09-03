const path = require('path');
// WEBPACK/WEBPACK_SERVE must come from the REAL process environment - the npm web
// scripts set WEBPACK=true via cross-env for exactly this. The same names also appear
// in webpack.config.js under DefinePlugin, but those are compile-time replacements
// inside the emitted bundle and never reach this file. Relying on them alone left
// isWeb permanently false, so `npm run build` (APP_ENV=prod) had its env silently
// overridden back to whatever a leftover mobile .env said - a prod web deploy baked
// with the dev backend. Verified by scripts/deploy-web.ps1 after every build.
const isWeb = process.env.WEBPACK_SERVE === 'true' || process.env.WEBPACK === 'true';

// For native builds, override:true makes a build-script-written .env authoritative
// for APP_ENV, beating any stale ambient/Gradle-daemon APP_ENV (see
// scripts/lib/app-env.ps1). For web builds the npm scripts set APP_ENV via
// cross-env, so don't let a leftover mobile .env override that.
// Use an absolute path: Gradle runs the bundler with cwd=android/, so a plain
// dotenv.config() (which resolves .env relative to cwd) would never find it.
require('dotenv').config({ override: !isWeb, path: path.resolve(__dirname, '.env') });

module.exports = {
  presets: isWeb
    ? [
      ['@babel/preset-env', { targets: { browsers: ['last 2 versions'] } }],
      ['@babel/preset-react', { runtime: 'automatic' }],
      '@babel/preset-typescript',
    ]
    : ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@config': path.resolve(__dirname, 'src/config/index.ts'),
          '@env': path.resolve(__dirname, 'src/config/index.ts'),
        },
      },
    ],
    [
      // NOTE: babel-plugin-transform-define stringifies the replacement value
      // itself (unlike webpack's DefinePlugin) - pass the RAW string, not
      // JSON.stringify(...), or the baked literal becomes '"dev"' (with quotes)
      // which never matches 'dev'/'preprod'/'prod' and silently falls back to prod.
      'transform-define',
      {
        'process.env.APP_ENV': process.env.APP_ENV || 'prod',
        '__APP_ENV__': process.env.APP_ENV || 'prod',
      },
    ],
    // Only apply reanimated plugin for native — it breaks on web
    ...(!isWeb ? ['react-native-reanimated/plugin'] : []),
  ],
};
