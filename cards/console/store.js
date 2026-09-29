/*
 * Where the console keeps its data.
 *
 * Today that is this browser's localStorage. The hosted version will swap in a
 * store backed by the Valleyside server (shared roster, staff logins, audit
 * log) behind this same small interface, so no screen has to change.
 *
 * Demo mode uses its own namespace, so a pitch can never touch a real roster.
 */
export function createStore(namespace, { memory = false } = {}) {
  const key = (k) => `${namespace}.${k}`;
  // The hosted console keeps nothing in the browser: the server has the
  // roster, and a shared office computer shouldn't hold a copy of it.
  const mem = new Map();
  const disk = memory ? {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k),
  } : null;
  const ls = () => disk || localStorage;
  const read = (k, fallback) => {
    try { return JSON.parse(ls().getItem(key(k))) ?? fallback; } catch { return fallback; }
  };
  const write = (k, v) => {
    try { ls().setItem(key(k), JSON.stringify(v)); return true; } catch { return false; }
  };
  return {
    namespace,
    loadIssuer: () => read("issuer", null),
    saveIssuer: (v) => write("issuer", v),
    loadMembers: () => read("members", []),
    saveMembers: (v) => write("members", v),
    loadRevocations: () => read("revocations", { publishedAt: null, numbers: [] }),
    saveRevocations: (v) => write("revocations", v),
    loadActivity: () => read("activity", []),
    saveActivity: (v) => write("activity", v.slice(-2000)),
    loadBackupAt: () => read("lastBackup", null),
    saveBackupAt: (v) => write("lastBackup", v),
    clear() {
      for (const k of ["issuer", "members", "revocations", "activity", "lastBackup"]) {
        try { ls().removeItem(key(k)); } catch {}
      }
    },
  };
}
