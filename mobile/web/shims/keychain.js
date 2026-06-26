// Web shim for `react-native-keychain`.
//
// Implements the subset of the Keychain API that StorageService.js uses,
// backed by `localStorage`. Each secret is namespaced by its `service` so the
// independent get/set/reset semantics of the native API are preserved.
//
// SECURITY NOTE: localStorage is NOT a secure secret store. Native Keychain /
// Android Keystore protects secrets at the OS level; on the web they live in
// plaintext in the browser's localStorage and are readable by any script that
// runs on the origin. This is an acceptable trade-off for a browser build but
// callers should be aware the web target is less secure than the device build.

const PREFIX = 'rnkeychain:';

const keyFor = (service) => PREFIX + (service || 'default');

// Keychain.setGenericPassword(username, password, { service })
export async function setGenericPassword(username, password, options = {}) {
    const key = keyFor(options.service);
    try {
        window.localStorage.setItem(
            key,
            JSON.stringify({ username, password })
        );
        return { service: options.service || 'default', storage: 'web-localStorage' };
    } catch (e) {
        return false;
    }
}

// Keychain.getGenericPassword({ service }) -> { username, password } | false
export async function getGenericPassword(options = {}) {
    const key = keyFor(options.service);
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            return false;
        }
        const parsed = JSON.parse(raw);
        if (parsed == null || typeof parsed.password !== 'string') {
            return false;
        }
        return {
            service: options.service || 'default',
            username: parsed.username,
            password: parsed.password
        };
    } catch (e) {
        return false;
    }
}

// Keychain.resetGenericPassword({ service }) -> boolean
export async function resetGenericPassword(options = {}) {
    const key = keyFor(options.service);
    try {
        window.localStorage.removeItem(key);
        return true;
    } catch (e) {
        return false;
    }
}

export default {
    setGenericPassword,
    getGenericPassword,
    resetGenericPassword
};
