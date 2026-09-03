import './src/mocks/exports-polyfill';
import { AppRegistry } from 'react-native';
import './src/global.css';
import App from './App'; // or './App.tsx'
import packageJson from './app.json';
const appName = packageJson.name;

AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, {
    rootTag: document.getElementById('root'),
});