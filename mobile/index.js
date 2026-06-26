// Must be first: sets up globalThis.crypto before libsignal loads.
import './src/cryptoPolyfill';
// Replace the WASM curve25519 (broken in Hermes) with a pure-JS one.
import './src/signalCurve';
// Initialize i18n (pure JS, Hermes-compatible) before the app mounts.
import './src/i18n';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
