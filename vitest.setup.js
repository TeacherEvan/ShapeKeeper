// Vitest setup file - provides localStorage polyfill for jsdom
// jsdom doesn't implement localStorage by default, so we add a simple in-memory implementation

const localStoragePolyfill = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] ?? null,
        setItem: (key, value) => {
            store[key] = String(value);
        },
        removeItem: (key) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
        get length() {
            return Object.keys(store).length;
        },
        key: (index) => Object.keys(store)[index] ?? null,
    };
})();

Object.defineProperty(global, 'localStorage', {
    value: localStoragePolyfill,
    writable: true,
    configurable: true,
});

// Also polyfill sessionStorage for completeness
Object.defineProperty(global, 'sessionStorage', {
    value: localStoragePolyfill,
    writable: true,
    configurable: true,
});

// Mock crypto.getRandomValues if not available
if (typeof global.crypto === 'undefined') {
    global.crypto = {
        getRandomValues: (arr) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        },
        randomUUID: () =>
            'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            }),
    };
} else if (!global.crypto.getRandomValues) {
    global.crypto.getRandomValues = (arr) => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    };
}
