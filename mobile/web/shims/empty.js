// Web shim for `react-native-get-random-values`.
//
// On native, that package patches `global.crypto.getRandomValues`. Browsers
// already expose a working `crypto.getRandomValues` (Web Crypto API), so there
// is nothing to polyfill here. We only make sure `global.crypto` is reachable
// via the `global` identifier that cryptoPolyfill.js / signalCurve.js use.
//
// (webpack maps `global` -> `window` via DefinePlugin, so this is mostly a
// safety net for environments where that alias is not applied.)
if (typeof global !== 'undefined' && typeof global.crypto === 'undefined' &&
    typeof window !== 'undefined' && window.crypto) {
    // eslint-disable-next-line no-global-assign
    global.crypto = window.crypto;
}

export default {};
