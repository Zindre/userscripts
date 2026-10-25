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
})();
