const isNode = typeof window === "undefined";

function createMemoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    key(index) { return Array.from(values.keys())[index] || null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(String(key), String(value)); },
  };
}

/** @type {Storage} */
const storage = isNode ? /** @type {Storage} */ (createMemoryStorage()) : window.localStorage;

function getAppParams() {
  if (isNode) return {};
  const params = new URLSearchParams(window.location.search);
  const appId = params.get("app_id") || import.meta.env.VITE_BASE44_APP_ID || storage.getItem("base44_app_id") || "";
  const token = params.get("access_token") || storage.getItem("base44_access_token") || "";
  const fromUrl = params.get("from_url") || import.meta.env.VITE_BASE44_APP_BASE_URL || storage.getItem("base44_from_url") || window.location.origin;

  if (appId) storage.setItem("base44_app_id", appId);
  if (token) storage.setItem("base44_access_token", token);
  if (fromUrl) storage.setItem("base44_from_url", fromUrl);

  if (params.has("access_token")) {
    params.delete("access_token");
    const query = params.toString();
    window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }

  return { appId, token, fromUrl };
}

export const appParams = getAppParams();

export function clearAppSession() {
  storage.removeItem("base44_access_token");
  storage.removeItem("base44_from_url");
}
