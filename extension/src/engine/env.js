// ───────────────────────────── Environment ─────────────────────────────
// This host, its entry in SITES, storage and fetching through the GM API (a userscript manager, or
// gm-shim.js in the extension).
const host = location.hostname.replace(/^www\./, '');
const site = SITES.find(s => s.host.test(host));
if (!site && !CFG.genericSites) return;

const gm = {
  async get(k, d) { try { return typeof GM !== 'undefined' && GM.getValue ? await GM.getValue(k, d) : d; } catch { return d; } },
  async set(k, v) { try { if (typeof GM !== 'undefined' && GM.setValue) await GM.setValue(k, v); } catch {} },
  xhr(opts) { return new Promise((res, rej) => {
    if (typeof GM === 'undefined' || !GM.xmlHttpRequest) return rej(new Error('no GM.xmlHttpRequest'));
    GM.xmlHttpRequest({ method: 'GET', timeout: 12000, onload: res, onerror: rej, ontimeout: rej, ...opts });
  }); },
};
// Running inside the browser extension (extension/): its toolbar popup replaces the in-page panel.
const EXT = typeof GM !== 'undefined' && typeof GM.exposeSettings === 'function';
