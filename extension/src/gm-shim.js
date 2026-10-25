// Gives declickbait.js the userscript-manager API it expects (GM.getValue, GM.setValue,
// GM.xmlHttpRequest, GM.info), backed by extension storage and a fetch in the background
// script, so the userscript runs unchanged as the content script. GM.exposeSettings is
// extension-only: the script hands over its settings handler, and the popup talks to it.
(() => {
  'use strict';
  const api = globalThis.browser ?? globalThis.chrome;
  let settingsHandler = null;
  const fetches = { ok: 0, failed: 0 }; // shown in the popup, so a site that blocks fetches is visible

  globalThis.GM = {
    info: { script: { name: api.runtime.getManifest().name, version: api.runtime.getManifest().version }, scriptHandler: 'NoThis extension' },
    async getValue(k, d) { const r = await api.storage.local.get(k); return k in r ? r[k] : d; },
    async setValue(k, v) { await api.storage.local.set({ [k]: v }); },
    xmlHttpRequest(o) {
      api.runtime.sendMessage({ type: 'declickbait-fetch', url: o.url, headers: o.headers, timeout: o.timeout }).then(r => {
        if (r && !r.error) { fetches[r.status < 400 ? 'ok' : 'failed']++; o.onload?.(r); }
        else { fetches.failed++; (r?.timedOut ? o.ontimeout : o.onerror)?.(new Error(r?.error || 'no response from background')); }
      }, e => { fetches.failed++; o.onerror?.(e); });
    },
    exposeSettings(fn) { settingsHandler = fn; },
  };

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== 'declickbait-settings' || !settingsHandler) return;
    settingsHandler(msg).then(s => sendResponse(s && { ...s, fetches }), e => sendResponse({ error: String(e) }));
    return true; // respond asynchronously
  });

  // This file runs before the page is drawn (document_start), the engine only once it has loaded.
  // On a site where plain view took over before, or that the reader set to a plain level, cover the
  // page with a calm background so the original never flashes. The engine lifts the cover
  // (#nothis-cover) as soon as plain view is up, or when it decides against it; after 6 s it goes anyway.
  const host = location.hostname.replace(/^www\./, '');
  try { if (sessionStorage.getItem('declickbait-original') === host) return; } catch {} // "Original" was pressed
  api.storage.local.get(['level', 'siteLevels', 'disabledHosts', 'plainHosts']).then(s => {
    const chosen = (s.siteLevels || {})[host], level = chosen || s.level;
    if ((level !== 'plain' && level !== 'pictures') || (s.disabledHosts || []).includes(host)) return;
    if (!chosen && !(s.plainHosts || []).includes(host)) return; // only sites known to get plain view
    const cover = document.createElement('style');
    cover.id = 'nothis-cover';
    cover.textContent = 'html{background:#fbfbf9!important}html>body{visibility:hidden!important}@media (prefers-color-scheme: dark){html{background:#1a1b1a!important}}';
    (document.head || document.documentElement).appendChild(cover);
    setTimeout(() => cover.remove(), 6000);
  });
})();
