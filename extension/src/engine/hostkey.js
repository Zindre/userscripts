// ───────────────────────────── Host keys ─────────────────────────────
// A host's 42-bit fingerprint as 7 characters, for NEWS_LIST (see sites.js). build.mjs runs this
// same function to make the list, so the two always agree. gm-shim.js gets this file and the list
// too, to cover news sites before they are drawn. cyrb53 hash (public domain, bryc).
const KEY_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function hostKey(h) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < h.length; i++) { const c = h.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  let n = 4294967296 * (2097151 & h2) + (h1 >>> 0), key = '';
  for (let i = 0; i < 7; i++) { key += KEY_CHARS[n % 64]; n = Math.floor(n / 64); }
  return key;
}
// Is this key on NEWS_LIST (sorted, 7 characters each)? Is this host, or a parent domain, listed?
function listedKey(key) {
  let lo = 0, hi = NEWS_LIST.length / 7 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, k = NEWS_LIST.substr(mid * 7, 7);
    if (k === key) return true;
    if (k < key) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}
function listedHost(h) {
  const p = h.split('.');
  for (let i = 0; i < p.length - 1; i++) if (listedKey(hostKey(p.slice(i).join('.')))) return true;
  return false;
}
