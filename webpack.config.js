const path = require('path');
const net = require('net');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

function findFreePort(startPort, maxPort = startPort + 100) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        // Listen with no host so Node binds to `::` (IPv6 dual-stack), the same
        // interface webpack-dev-server uses. Probing '0.0.0.0' (IPv4-only) would
        // miss a stale server holding the IPv6 socket and wrongly report the port free.
        server.listen(startPort, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            if (startPort >= maxPort) {
                reject(new Error(`No free port found between ${startPort} and ${maxPort}`));
                return;
            }
            resolve(findFreePort(startPort + 1, maxPort));
        });
    });
}

const appDirectory = path.resolve(__dirname);

const packagesToTranspile = [
    '@codeimplants/support',
    '@codeimplants/ui-kit',
    '@codeimplants/app-core',
    '@codeimplants/app-network',
    '@codeimplants/analytics',
    '@codeimplants/version-control',
    'react-native',
    'react-native-web',
    '@gluestack-ui',
    '@gluestack-style',
    '@expo/html-elements',
    'lucide-react',
    'lucide-react-native',
    'react-native-reanimated',
    '@react-navigation',
    '@react-native',
    '@react-native-community',
    '@react-native-async-storage',
    'react-native-safe-area-context',
    'react-native-svg',
    'react-native-worklets',
    'react-native-webview',
    'react-native-linear-gradient',
    'react-native-gesture-handler',
    'react-native-screens',
    'react-native-vector-icons',
].join('|');

const babelLoaderConfiguration = {
    test: /\.(js|jsx|ts|tsx)$/,
    exclude: new RegExp(`node_modules/(?!(${packagesToTranspile})(/|$))`),
    type: 'javascript/auto',
    use: {
        loader: 'babel-loader',
        options: {
            configFile: false,
            babelrc: false,
            cacheDirectory: true,
            cacheIdentifier: `app-env-${process.env.APP_ENV || 'prod'}`,
            sourceType: 'unambiguous',
            presets: [
                ['@babel/preset-env', { 
                    targets: { browsers: ['last 2 versions'] }
                }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
            ],
            plugins: [
                'react-native-web',
                '@babel/plugin-transform-runtime',
                ['@babel/plugin-transform-class-properties', { loose: true }],
                ['@babel/plugin-transform-private-methods', { loose: true }],
                ['@babel/plugin-transform-private-property-in-object', { loose: true }],
                '@babel/plugin-transform-modules-commonjs',
            ],
        },
    },
};

// Import app.json and extract appName
const packageJson = require('./app.json');
const appName = packageJson.name;

// react-native-device-info is stubbed on web, so the About screen has no way to
// read the shipped version at runtime. Take it from the same file the Android
// build does, so a version bump flows to the web build with no second edit.
function readAndroidVersion() {
    try {
        const gradle = fs.readFileSync(
            path.resolve(appDirectory, 'android/app/build.gradle'),
            'utf8',
        );
        return {
            name: (gradle.match(/versionName\s+"([^"]+)"/) || [])[1] || null,
            code: (gradle.match(/versionCode\s+(\d+)/) || [])[1] || null,
        };
    } catch (e) {
        console.warn('Could not read version from build.gradle:', e.message);
        return { name: null, code: null };
    }
}

const androidVersion = readAndroidVersion();

const webNativeModule = path.resolve(appDirectory, 'src/mocks/webNativeModule.js');
const webNetInfoModule = path.resolve(appDirectory, 'src/mocks/netinfo.js');

module.exports = async () => {
    const port = await findFreePort(8081);
    console.log(`Starting dev server on port ${port}`);
    return {
    entry: path.resolve(appDirectory, 'index.web.js'),
    output: {
        filename: 'bundle.web.js',
        path: path.resolve(appDirectory, 'dist'),
        publicPath: '/',
    },
    resolve: {
        modules: [path.resolve(appDirectory, 'node_modules'), 'node_modules'],
        extensions: [
            '.web.tsx',
            '.web.ts',
            '.web.jsx',
            '.web.js',
            '.tsx',
            '.ts',
            '.jsx',
            '.js',
            '.mjs',
            '.json',
        ],
        alias: {
            'react-native$': 'react-native-web',
            '@config$': path.resolve(appDirectory, 'src/config/index.ts'),
            '@env$': path.resolve(appDirectory, 'src/config/index.ts'),
            'react': path.resolve(appDirectory, 'node_modules/react'),
            'react-dom': path.resolve(appDirectory, 'node_modules/react-dom'),
            'react/jsx-runtime': path.resolve(appDirectory, 'node_modules/react/jsx-runtime'),

            // Native-only stubs
            'expo-application$': webNativeModule,
            'expo-constants$': webNativeModule,
            'react-native-device-info$': webNativeModule,
            '@react-native-community/netinfo$': webNetInfoModule,

            // Mocks
            // Reached because AddCustomerModal imports ContactsStep statically,
            // even though web never renders it — see the stub for why.
            'expo-contacts': path.resolve(__dirname, 'src/mocks/expo-contacts.js'),
            'react-native-fs': path.resolve(__dirname, 'src/mocks/react-native-fs.js'),
            'react-native-print': path.resolve(__dirname, 'src/mocks/react-native-print.js'),
            'react-native-html-to-pdf': path.resolve(__dirname, 'src/mocks/react-native-html-to-pdf.js'),
            'react-native-share': path.resolve(__dirname, 'src/mocks/react-native-share.js'),
            'react-native-image-picker': path.resolve(__dirname, 'src/mocks/react-native-image-picker.js'),
            // Thermal printing is native-only, but the print path is shared with web,
            // so these get imported here and would otherwise break the bundle on load.
            'react-native-ble-plx': path.resolve(__dirname, 'src/mocks/react-native-ble-plx.js'),
            'react-native-tcp-socket': path.resolve(__dirname, 'src/mocks/react-native-tcp-socket.js'),
            'react-native-view-shot': path.resolve(__dirname, 'src/mocks/react-native-view-shot.js'),
            'react-native-contacts': path.resolve(__dirname, 'src/mocks/react-native-contacts.js'),
            'react-native-linear-gradient$': path.resolve(__dirname, 'src/mocks/react-native-linear-gradient.js'),
            '@react-native-firebase/app': path.resolve(__dirname, 'src/mocks/firebase.js'),
            '@react-native-firebase/analytics': path.resolve(__dirname, 'src/mocks/firebase.js'),
        },
    },
    module: {
        rules: [
            // Handle .mjs ESM files from node_modules
            {
                test: /\.(js|jsx|mjs|ts|tsx)$/,
                resolve: { fullySpecified: false },
                type: 'javascript/auto',
            },
            babelLoaderConfiguration,
            {
                test: /\.(gif|jpe?g|png)$/,
                type: 'asset/resource',
            },
            {
                test: /\.svg$/,
                use: ['@svgr/webpack'],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.WEBPACK': JSON.stringify('true'),
            'process.env.WEBPACK_SERVE': JSON.stringify('true'),
            __DEV__: JSON.stringify(true),
            __APP_ENV__: JSON.stringify(process.env.APP_ENV || 'prod'),
            'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV || 'prod'),
            // Lets start.cmd point the web build at a backend on this machine
            // without editing src/config/environments/*.ts. Empty when unset, so
            // the `||` fallback in those files keeps the hosted URL for every
            // other build. Native is unaffected: nothing defines this for Metro,
            // so process.env.API_BASE_URL is simply undefined there and the same
            // fallback applies.
            'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || ''),
            // React Native's HMRClient.setup() branches on this: with EXPO_OS === 'web'
            // it accepts an options object, otherwise it asserts on a platform *string*
            // and throws `Missing required parameter \`platform\`` during startup, which
            // blanked the whole page. babel-preset-expo would normally inline it, but it
            // is not in the preset list above, so nothing did. Hardcoded rather than read
            // from process.env: this config only ever builds the react-native-web target,
            // so 'web' is a fact about the bundle, not a per-invocation choice.
            'process.env.EXPO_OS': JSON.stringify('web'),
            __APP_VERSION_NAME__: JSON.stringify(androidVersion.name),
            __APP_VERSION_CODE__: JSON.stringify(androidVersion.code),
        }),
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(appDirectory, 'public/index.html'),
        }),
    ],
    devServer: {
        port,
        hot: true,
        open: true,
        historyApiFallback: true,
    },
    };
};
