// My news (mix.html): the engine, run in the extension's own page instead of on a news site. This gives it the GM API
// that gm-shim.js gives it on a site: storage straight from extension storage, and fetches straight from here (an
// extension page may read the sites it has permission for). The engine sees __wdMix and lays out My news (mixView).
'use strict';
globalThis.__wdMix = true;
{
  const api = globalThis.browser ?? globalThis.chrome;
  // The engine's texts go by the page's language: here, the browser's.
  document.documentElement.lang = api.i18n?.getUILanguage?.() || navigator.language || 'en';
  globalThis.GM = {
    info: { script: { name: api.runtime.getManifest().name, version: api.runtime.getManifest().version }, scriptHandler: 'Web Detox extension' },
    async getValue(k, d) { const s = await api.storage.local.get(k); return k in s ? s[k] : d; },
    async getValues(defaults) { const s = await api.storage.local.get(Object.keys(defaults)); return Object.fromEntries(Object.entries(defaults).map(([k, d]) => [k, k in s ? s[k] : d])); },
    async setValue(k, v) { await api.storage.local.set({ [k]: v }); },
    xmlHttpRequest(o) {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), o.timeout || 12000);
      fetch(o.url, { headers: o.headers || {}, credentials: 'include', redirect: 'follow', signal: ctrl.signal })
        .then(async r => o.onload?.({ status: r.status, finalUrl: r.url, responseText: await r.text() }))
        .catch(e => (e.name === 'AbortError' ? o.ontimeout : o.onerror)?.(e))
        .finally(() => clearTimeout(timer));
    },
    exposeSettings() {},
  };
}
