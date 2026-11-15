// Fetches article pages for the content script. Content scripts cannot read cross-origin
// responses in Manifest V3; the background can, thanks to the extension's host permissions.
'use strict';
const api = globalThis.browser ?? globalThis.chrome;

// Safari only (the others have it in the manifest, and no scripting permission): snapchat-web.js, in the page's world.
const registerPageScript = async () => {
  await api.scripting.unregisterContentScripts({ ids: ['snapchat-web'] }).catch(() => {});
  await api.scripting.registerContentScripts([{ id: 'snapchat-web', matches: ['https://www.snapchat.com/web*', 'https://snapchat.com/web*'],
    js: ['snapchat-web.js'], runAt: 'document_start', world: 'MAIN' }]);
};
if (api.scripting) for (const ev of [api.runtime.onInstalled, api.runtime.onStartup]) ev.addListener(registerPageScript);

// Ads in front of videos: the video player asks an ad schedule (VMAP) or an ad (VAST) from these addresses
// before the video. Blocked, it plays the video straight away. Schibsted's player: VG, VGTV, Aftenposten, BT, E24,
// Aftonbladet, SvD. Replaced as a whole on every start, so a rule taken out here goes from the browser too.
const AD_RULES = ['||vmap.stream.schibsted.media^', '||adnxs-simple.com/ptv'].map((urlFilter, i) =>
  ({ id: i + 1, priority: 1, action: { type: 'block' }, condition: { urlFilter, resourceTypes: ['xmlhttprequest', 'media', 'other'] } }));
const blockVideoAds = async () => {
  if (!api.declarativeNetRequest) return;
  const old = (await api.declarativeNetRequest.getDynamicRules()).map(r => r.id);
  await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old, addRules: AD_RULES }).catch(e => console.warn('Web Detox: ad rules', e));
};
for (const ev of [api.runtime.onInstalled, api.runtime.onStartup]) ev.addListener(blockVideoAds);

// Safari only (nativeMessaging): whether the extension may run on all websites, for the app's first screen, which can't
// ask Safari that itself. Checked each time Safari starts this page; told to the app when it changed, or once an hour.
const reportAccess = async force => {
  if (!api.runtime.sendNativeMessage || !api.permissions) return;
  try {
    const all = await api.permissions.contains({ origins: ['http://*/*', 'https://*/*'] });
    const { accessTold } = await api.storage.local.get('accessTold');
    if (force !== true && accessTold?.all === all && Date.now() - accessTold.at < 3600e3) return;
    await api.runtime.sendNativeMessage('no.sedb.NoThis', { type: 'access', all });
    await api.storage.local.set({ accessTold: { all, at: Date.now() } });
  } catch (e) { console.warn('Web Detox: access report', e); }
};
for (const ev of [api.permissions?.onAdded, api.permissions?.onRemoved]) ev?.addListener(() => reportAccess(true));
reportAccess();
api.runtime.onMessage.addListener(msg => { if (msg?.type === 'nothis-access') reportAccess(); });

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'declickbait-fetch' || !sender.tab) return;
  let url;
  try { url = new URL(msg.url); } catch { sendResponse({ error: 'bad url' }); return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') { sendResponse({ error: 'unsupported protocol' }); return; }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), msg.timeout || 12000);
  // Cookies included, as GM.xmlHttpRequest does: consent walls then serve the real article.
  fetch(url, { method: 'GET', headers: msg.headers || {}, credentials: 'include', redirect: 'follow', signal: ctrl.signal })
    .then(async r => sendResponse({ status: r.status, finalUrl: r.url, responseText: await r.text() }))
    .catch(e => sendResponse({ error: String(e), timedOut: e.name === 'AbortError' }))
    .finally(() => clearTimeout(timer));
  return true; // respond asynchronously
});

// ───────────────────────── Sync across the user's devices ─────────────────────────
// Read later, Bookmarks, what has been read (for "Hide read"), the section layout of each site and the list's two
// settings follow the user from device to device: in Chrome, Edge and Firefox through the browser's own account sync
// (storage.sync), in Safari through iCloud, which the app keeps (SafariWebExtensionHandler.swift). No server of ours.
//
// One small document holds it all, and every device merges what it has with what is stored, newest first, item by item:
// an article saved here and another saved on the phone both stay; one taken out is remembered as taken out (for 30 days)
// so it doesn't come back from the other device. Read articles go as short hashes of their address, the last 14 days.
//
// "Delete everything" in the popup (wd-erase below) sets erased: what was saved, read or set up before that time goes on
// every device as it next syncs, and what this device has goes at once.
//
// { v: 1, erased: time, saved: { later: { key: [url, title, host, at, gone] }, marks: {...} }, read: { hash: day },
//   layout: { host: { order, hidden, at } }, prefs: { sort: [value, at], hideRead: [value, at] } }
const SYNCED = ['plainSaved', 'plainRead', 'plainReadSync', 'plainLayout', 'plainSort', 'plainHideRead', 'syncMeta'];
const DAY = 864e5, KEEP_GONE = 30 * DAY, KEEP_READ = 14;
// The same hash as plain.js (readHash): FNV-1a, in base 36.
const readHash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
const syncStore = api.runtime.getManifest().permissions?.includes('nativeMessaging')
  ? { // Safari: the app's iCloud key-value store, through the extension's native handler.
    async get() { const r = await api.runtime.sendNativeMessage('no.sedb.NoThis', { type: 'sync-get' }); return r?.data ? JSON.parse(r.data) : null; },
    async put(doc) { await api.runtime.sendNativeMessage('no.sedb.NoThis', { type: 'sync-put', data: JSON.stringify(doc) }); },
  }
  : api.storage?.sync && { // The browser's account sync: at most 8 kB a key, so the document goes in pieces.
    async get() {
      const all = await api.storage.sync.get(null), n = all['wd:n'];
      if (!n) return null;
      let s = ''; for (let i = 0; i < n; i++) s += all['wd:' + i] || '';
      return JSON.parse(s);
    },
    async put(doc) {
      // Non-ASCII as \u escapes, so a piece of 3500 characters stays under the limit however it is counted.
      const s = JSON.stringify(doc).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
      const parts = []; for (let i = 0; i < s.length; i += 3500) parts.push(s.slice(i, i + 3500));
      const old = (await api.storage.sync.get('wd:n'))['wd:n'] || 0;
      await api.storage.sync.set(Object.fromEntries([...parts.map((p, i) => ['wd:' + i, p]), ['wd:n', parts.length]]));
      const extra = []; for (let i = parts.length; i < old; i++) extra.push('wd:' + i);
      if (extra.length) await api.storage.sync.remove(extra);
    },
  };

const emptyDoc = () => ({ v: 1, erased: 0, saved: { later: {}, marks: {} }, read: {}, layout: {}, prefs: {} });
// What this device has, as a document.
function localDoc(l) {
  const doc = emptyDoc(), meta = l.syncMeta || {}, now = Date.now(), today = Math.floor(now / DAY);
  doc.erased = meta.erased || 0;
  for (const kind of ['later', 'marks']) {
    for (const s of l.plainSaved?.[kind] || []) doc.saved[kind][s.key] = [s.url, String(s.teaser || '').slice(0, 140), s.host || '', s.at || 0, 0];
    for (const [key, at] of Object.entries(meta.gone?.[kind] || {})) if (!(doc.saved[kind][key]?.[3] > at)) doc.saved[kind][key] = ['', '', '', at, 1];
  }
  doc.read = { ...(l.plainReadSync || {}) };
  for (const [key, t] of Object.entries(l.plainRead || {})) { const d = Math.floor(t / DAY); if (today - d < KEEP_READ) doc.read[readHash(key)] = Math.max(doc.read[readHash(key)] || 0, d); }
  for (const [host, lay] of Object.entries(l.plainLayout || {})) doc.layout[host] = { order: lay.order || [], hidden: lay.hidden || [], at: lay.at || 0 };
  doc.prefs = { sort: [l.plainSort ?? 'site', meta.prefsAt?.sort || 0], hideRead: [!!l.plainHideRead, meta.prefsAt?.hideRead || 0] };
  return doc;
}
// Two documents into one: per item, the newer wins. Then what is old goes, and the lists are kept small.
function mergeDocs(a, b) {
  const out = emptyDoc(), now = Date.now(), today = Math.floor(now / DAY), newer = (x, y, at) => !y || (x && at(x) >= at(y)) ? x : y;
  const erased = out.erased = Math.max(a.erased || 0, b.erased || 0), erasedDay = erased ? Math.floor(erased / DAY) : -1;
  for (const kind of ['later', 'marks']) {
    const all = { ...b.saved?.[kind] };
    for (const [k, v] of Object.entries(a.saved?.[kind] || {})) all[k] = newer(v, all[k], e => e[3]);
    for (const [k, v] of Object.entries(all)) if (v[3] <= erased) delete all[k];
    const live = Object.entries(all).filter(([, v]) => !v[4]).sort((x, y) => y[1][3] - x[1][3]).slice(0, 150);
    const gone = Object.entries(all).filter(([, v]) => v[4] && now - v[3] < KEEP_GONE);
    out.saved[kind] = Object.fromEntries([...live, ...gone]);
  }
  const read = { ...b.read };
  for (const [h, d] of Object.entries(a.read || {})) read[h] = Math.max(read[h] || 0, d);
  out.read = Object.fromEntries(Object.entries(read).filter(([, d]) => today - d < KEEP_READ && d > erasedDay).sort((x, y) => y[1] - x[1]).slice(0, 800));
  const hosts = new Set([...Object.keys(a.layout || {}), ...Object.keys(b.layout || {})]);
  out.layout = Object.fromEntries([...hosts].map(h => [h, newer(a.layout?.[h], b.layout?.[h], e => e.at || 0)]).filter(([, lay]) => (lay.at || 0) > erased).sort((x, y) => (y[1].at || 0) - (x[1].at || 0)).slice(0, 60));
  for (const p of ['sort', 'hideRead']) { const x = newer(a.prefs?.[p], b.prefs?.[p], e => e[1]); if (x && x[1] > erased) out.prefs[p] = x; }
  return out;
}
// The merged document back into this device's storage. Description and picture of a saved article stay as they were
// here (they don't travel; the list fetches them again).
function localFrom(doc, l) {
  const was = Object.fromEntries(['later', 'marks'].map(k => [k, new Map((l.plainSaved?.[k] || []).map(s => [s.key, s]))]));
  const plainSaved = {}, gone = {};
  for (const kind of ['later', 'marks']) {
    const items = Object.entries(doc.saved[kind]);
    plainSaved[kind] = items.filter(([, v]) => !v[4]).sort((x, y) => y[1][3] - x[1][3]).map(([key, [url, teaser, host, at]]) => {
      const old = was[kind].get(key);
      return { key, url, teaser, desc: old?.desc || '', img: old?.img || '', host, at };
    });
    gone[kind] = Object.fromEntries(items.filter(([, v]) => v[4]).map(([k, v]) => [k, v[3]]));
  }
  // Deleted on another device since this one last looked: what this device read and set up before then goes too.
  const erasedNow = (doc.erased || 0) > (l.syncMeta?.erased || 0), erased = doc.erased || 0;
  const plainLayout = Object.fromEntries(Object.entries(l.plainLayout || {}).filter(([, lay]) => !erasedNow || (lay.at || 0) > erased));
  for (const [host, lay] of Object.entries(doc.layout)) if (!plainLayout[host] || (lay.at || 0) > (plainLayout[host].at || 0)) plainLayout[host] = lay;
  const out = {
    plainSaved, plainReadSync: doc.read, plainLayout,
    plainSort: doc.prefs.sort?.[0] ?? (erasedNow ? 'site' : l.plainSort ?? 'site'), plainHideRead: doc.prefs.hideRead?.[0] ?? (erasedNow ? false : !!l.plainHideRead),
    syncMeta: { erased, gone, prefsAt: { sort: doc.prefs.sort?.[1] || 0, hideRead: doc.prefs.hideRead?.[1] || 0 } },
  };
  if (erasedNow) out.plainRead = Object.fromEntries(Object.entries(l.plainRead || {}).filter(([, t]) => t > erased));
  return out;
}

// One sync at a time; a change while one runs makes another follow it.
let syncing = null, syncAgain = false, applying = 0, lastPull = 0;
async function syncNow() {
  if (!syncStore) return;
  if (syncing) { syncAgain = true; return syncing; }
  syncing = (async () => {
    try {
      const l = await api.storage.local.get(SYNCED), remote = await syncStore.get().catch(() => null);
      const merged = mergeDocs(localDoc(l), remote || emptyDoc());
      if (JSON.stringify(merged) !== JSON.stringify(remote)) await syncStore.put(merged);
      const next = localFrom(merged, l), changed = Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(l[k] ?? null)));
      if (Object.keys(changed).length) { applying++; try { await api.storage.local.set(changed); } finally { setTimeout(() => applying--, 500); } }
      lastPull = Date.now();
    } catch (e) { console.warn('Web Detox: sync', e); }
  })();
  await syncing;
  syncing = null;
  if (syncAgain) { syncAgain = false; return syncNow(); }
}
let syncTimer = 0;
const syncSoon = (ms = 2000) => { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, ms); };
api.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' && Object.keys(changes).some(k => k.startsWith('wd:'))) return syncSoon(500); // another device
  if (area !== 'local' || applying || !SYNCED.some(k => k in changes && k !== 'syncMeta' && k !== 'plainReadSync')) return;
  // A change made on this device: note what was taken out of the saved lists, and when a setting changed.
  const { syncMeta = {} } = await api.storage.local.get('syncMeta'), now = Date.now();
  const meta = { ...syncMeta, gone: { later: {}, marks: {}, ...syncMeta.gone }, prefsAt: { ...syncMeta.prefsAt } };
  if (changes.plainSaved) for (const kind of ['later', 'marks']) {
    const after = new Set((changes.plainSaved.newValue?.[kind] || []).map(s => s.key));
    for (const s of changes.plainSaved.oldValue?.[kind] || []) if (!after.has(s.key)) meta.gone[kind] = { ...meta.gone[kind], [s.key]: now };
  }
  if (changes.plainSort) meta.prefsAt.sort = now;
  if (changes.plainHideRead) meta.prefsAt.hideRead = now;
  await api.storage.local.set({ syncMeta: meta });
  syncSoon();
});
// At start, and when a page opens (gm-shim.js asks): what the other devices did meanwhile. Safari has no event for a
// change in iCloud, so it looks at most once a minute.
syncSoon(1000);
api.runtime.onMessage.addListener(msg => { if (msg?.type === 'wd-sync' && Date.now() - lastPull > 60e3) syncSoon(0); });

// "Delete everything Web Detox has stored" (popup): every setting, saved article, read article, section layout and the
// article cache on this device, back to how it was installed; and, through sync, what was saved, read and set up on
// the user's other devices before now. The browser's account or iCloud then holds only the time of the deletion.
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only from the extension's own pages (the popup), never from a web page's content script.
  if (msg?.type !== 'wd-erase' || !(sender.url || '').startsWith(api.runtime.getURL(''))) return;
  (async () => {
    applying++;
    try {
      const erased = Date.now();
      await api.storage.local.clear();
      await api.storage.local.set({ syncMeta: { erased } });
      if (syncStore) await syncStore.put({ ...emptyDoc(), erased }).catch(e => console.warn('Web Detox: erase sync', e));
      sendResponse({ ok: true });
    } catch (e) { sendResponse({ error: String(e) }); } finally { setTimeout(() => applying--, 500); }
  })();
  return true;
});
