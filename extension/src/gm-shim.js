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

  // This file runs before the page is drawn (document_start), the engine only once it has loaded,
  // so plain view would show the original front page for a moment first. Instead the page is covered
  // with a calm background before anything is drawn: at once on the front or a section page of a
  // known news site (NEWS_LIST, put in below by build.mjs), since waiting for the settings lets the
  // page be drawn first, notably in Safari. The settings, read next, take the cover off again when
  // the site isn't at a plain level; a site off the list is covered once they are read if plain view
  // has taken it over before. The engine lifts the cover (#nothis-cover) as soon as plain view is up
  // or when it decides against it; after 12 s it goes anyway.
  // @include news-list
  const host = location.hostname.replace(/^www\./, '');
  try { if (sessionStorage.getItem('declickbait-original') === host) return; } catch {} // "Original" was pressed
  let path = location.pathname; try { path = decodeURIComponent(path); } catch {}
  if (!/^\/(?:[\p{L}-]{1,30}\/?){0,2}$/u.test(path)) return; // "/", "/sport", "/nyheter/innenriks": not an article
  let cover = null;
  const put = () => {
    if (cover) return;
    cover = document.createElement('style');
    cover.id = 'nothis-cover';
    // opacity too: an element can make itself visible again (VG's timestamps), not opaque.
    cover.textContent = 'html{background:#fbfbf9!important}html>body{visibility:hidden!important;opacity:0!important}@media (prefers-color-scheme: dark){html{background:#1a1b1a!important}}';
    (document.head || document.documentElement).appendChild(cover);
    setTimeout(() => cover.remove(), 12000);
  };
  if (typeof listedHost === 'function' && listedHost(host)) put();
  api.storage.local.get(['level', 'siteLevels', 'disabledHosts', 'plainHosts']).then(s => {
    const chosen = (s.siteLevels || {})[host], level = chosen || s.level || 'pictures'; // 'pictures' is the default level
    if ((level !== 'plain' && level !== 'pictures') || (s.disabledHosts || []).includes(host)) { cover?.remove(); return; }
    if (chosen || (s.plainHosts || []).includes(host)) put();
  });
})();
