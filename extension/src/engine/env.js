// ───────────────────────────── Environment ─────────────────────────────
// This host, its entry in SITES, storage and fetching through the GM API (a userscript manager, or
// gm-shim.js in the extension).
const host = location.hostname.replace(/^www\./, '');
// A known news site: its SITES entry, or a generic entry (article: null) for NEWS_HOSTS and for
// NEWS_LIST hosts whose page is not a shop or a wiki.
const site = SITES.find(s => s.host.test(host)) ||
  (curatedHost(host) || (listedHost(host) && !notNewsPage(true)) ? { host: null, article: null } : undefined);
if (!site && !CFG.genericSites) return;

const gm = {
  async get(k, d) { try { return typeof GM !== 'undefined' && GM.getValue ? await GM.getValue(k, d) : d; } catch { return d; } },
  async set(k, v) { try { if (typeof GM !== 'undefined' && GM.setValue) await GM.setValue(k, v); } catch {} },
  xhr(opts) { return new Promise((res, rej) => {
    // Pages on this site are fetched from the page itself, as a first-party request with your own
    // cookies: a subscriber gets the article as on the site. (The extension's background fetch
    // may go without them; Safari keeps a site's cookies to the site.)
    // If that fails (a strict page policy), the GM fetch takes over.
    const viaGM = () => {
      if (typeof GM === 'undefined' || !GM.xmlHttpRequest) return rej(new Error('no GM.xmlHttpRequest'));
      GM.xmlHttpRequest({ method: 'GET', timeout: 12000, onload: res, onerror: rej, ontimeout: rej, ...opts });
    };
    let same = false; try { same = new URL(opts.url, location.href).origin === location.origin; } catch {}
    if (!same) return viaGM();
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), opts.timeout || 12000);
    fetch(opts.url, { headers: opts.headers || {}, credentials: 'include', redirect: 'follow', signal: ctrl.signal })
      .then(async r => res({ status: r.status, finalUrl: r.url, responseText: await r.text() }), viaGM)
      .finally(() => clearTimeout(timer));
  }); },
};
// Running inside the browser extension (extension/): its toolbar popup replaces the in-page panel.
const EXT = typeof GM !== 'undefined' && typeof GM.exposeSettings === 'function';
