const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
};

const windowListeners = new Map();
const documentListeners = new Map();
globalThis.__testWindowListeners = windowListeners;
globalThis.__testDocumentListeners = documentListeners;

globalThis.window = {
  location: { origin: "https://talabaty.example.com" },
  devicePixelRatio: 1,
  screen: { deviceXDPI: 96, logicalXDPI: 96 },
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  addEventListener: (ev, fn) => {
    if (!windowListeners.has(ev)) windowListeners.set(ev, new Set());
    windowListeners.get(ev).add(fn);
  },
  removeEventListener: (ev, fn) => {
    windowListeners.get(ev)?.delete(fn);
  },
  dispatchEvent: (ev) => {
    windowListeners.get(ev)?.forEach((fn) => fn());
  },
};

globalThis.document = {
  visibilityState: "visible",
  createElement: () => ({ style: {} }),
  documentElement: { style: {} },
  addEventListener: (ev, fn) => {
    if (!documentListeners.has(ev)) documentListeners.set(ev, new Set());
    documentListeners.get(ev).add(fn);
  },
  removeEventListener: (ev, fn) => {
    documentListeners.get(ev)?.delete(fn);
  },
};
