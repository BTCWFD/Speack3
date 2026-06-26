// In-memory mock for 'react-native-keychain'.
//
// Stores a single { username, password } record per service in a plain JS
// object so tests that touch secure storage don't require native code. Mirrors
// the subset of the API the app uses.

let store = {};

const setGenericPassword = jest.fn(async (username, password, options = {}) => {
    const service = options.service || 'default';
    store[service] = { username, password, service };
    return true;
});

const getGenericPassword = jest.fn(async (options = {}) => {
    const service = options.service || 'default';
    return store[service] || false;
});

const resetGenericPassword = jest.fn(async (options = {}) => {
    const service = options.service || 'default';
    delete store[service];
    return true;
});

// Test helper: wipe the in-memory keychain between tests if needed.
const __reset = () => {
    store = {};
    setGenericPassword.mockClear();
    getGenericPassword.mockClear();
    resetGenericPassword.mockClear();
};

module.exports = {
    setGenericPassword,
    getGenericPassword,
    resetGenericPassword,
    __reset,
    ACCESSIBLE: {},
    ACCESS_CONTROL: {},
    SECURITY_LEVEL: {},
    STORAGE_TYPE: {},
};
