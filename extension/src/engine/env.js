// ───────────────────────────── Environment ─────────────────────────────
// This host, its entry in SITES, storage and fetching through the GM API (a userscript manager, or
// gm-shim.js in the extension).
const host = location.hostname.replace(/^www\./, '');
const timeMark = n => globalThis.__wdMark?.(n); // timing marks: see gm-shim.js (not 'mark': plain view has its own)
// A known news site: its SITES entry, or a generic entry (article: null) for NEWS_HOSTS and for
// NEWS_LIST hosts whose page is not a shop or a wiki.
const site = SITES.find(s => s.host.test(host)) ||
  (curatedHost(host) || (listedHost(host) && !notNewsPage(true)) ? { host: null, article: null } : undefined);
// A site to calm rather than read (calm-sites.js).
const calmSite = CALM_SITES.find(s => s.host.test(host));
if (!site && !calmSite && !CFG.genericSites) return;

// Robot checks (DataDome, Cloudflare, HUMAN, Akamai), on the page itself or in a fetched page. Fetching many articles in a
// short time is what they look for (nytimes.com showed one): a site that answers with one, or with 429 Too Many Requests,
// gets no more fetches for six hours, in any tab, and the fetches done in the background are spaced out (paced()).
const BOT_WALL = 'iframe[src*="captcha-delivery.com"], script[src*="captcha-delivery.com"], script[src*="/cdn-cgi/challenge-platform/"], #challenge-form, #challenge-stage, #px-captcha, #sec-if-cpt-container, #sec-cpt-if';
const BOT_TEXT = /captcha-delivery\.com|\/cdn-cgi\/challenge-platform\/|px-captcha|sec-if-cpt|confirm (?:that )?you are (?:a )?human/i;
const botWall = () => !!document.querySelector(BOT_WALL) || /^(just a moment|attention required)\b/i.test(document.title);
const PAUSE_MS = 6 * 3600e3, FETCH_GAP = 300;
let fetchPausedUntil = 0, nextFetchAt = 0, xhrCount = 0;
function pauseFetching() {
  if (Date.now() < fetchPausedUntil) return;
  fetchPausedUntil = Date.now() + PAUSE_MS;
  gm.get('pausedHosts', {}).then(p => {
    const now = Date.now(), keep = Object.fromEntries(Object.entries(p || {}).filter(([, t]) => t > now));
    gm.set('pausedHosts', { ...keep, [host]: fetchPausedUntil });
  });
}
// Waits for this fetch's turn: one every FETCH_GAP ms. Not for an article you are opening.
function paced() {
  const now = Date.now(), at = Math.max(now, nextFetchAt);
  nextFetchAt = at + FETCH_GAP;
  return at > now ? new Promise(r => setTimeout(r, at - now)) : Promise.resolve();
}
const robotCheck = r => r.status === 429 || ((r.status >= 400 || (r.responseText || '').length < 30000) && BOT_TEXT.test(r.responseText || ''));

const gm = {
  async get(k, d) { try { return typeof GM !== 'undefined' && GM.getValue ? await GM.getValue(k, d) : d; } catch { return d; } },
  // Several settings at once, as { key: default }: one wait instead of one per setting. In Safari each wait went through
  // the page's task queue, 50 ms and more on a busy front page.
  async getAll(defaults) {
    try { if (typeof GM !== 'undefined' && GM.getValues) return await GM.getValues(defaults); } catch {}
    const out = {};
    for (const k in defaults) out[k] = await gm.get(k, defaults[k]);
    return out;
  },
  async set(k, v) { try { if (typeof GM !== 'undefined' && GM.setValue) await GM.setValue(k, v); } catch {} },
  xhr(opts) {
    if (Date.now() < fetchPausedUntil) return Promise.reject(new Error('paused'));
    return gm.rawXhr(opts).then(r => { if (robotCheck(r)) { pauseFetching(); throw new Error('robot check'); } return r; });
  },
  rawXhr(opts) {
    // Timing marks for the first fetches (gm-shim.js): how long Safari takes over a fetch from the page and one through
    // the background page.
    const n = ++xhrCount, t0 = performance.now(), note = what => { if (n <= 4) timeMark(`fetch${n}-${what}-${Math.round(performance.now() - t0)}ms`); };
    return gm.fetchOnce(opts, note).then(r => { note('ok' + r.status); return r; }, e => { note('failed'); throw e; });
  },
  fetchOnce(opts, note) { return new Promise((res, rej) => {
    // Pages on this site are fetched from the page itself, as a first-party request with your own
    // cookies: a subscriber gets the article as on the site. (The extension's background fetch
    // may go without them; Safari keeps a site's cookies to the site.)
    // If that fails (a strict page policy), the GM fetch takes over.
    const viaGM = () => {
      note('via-background');
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
// The guard against redirects to the app goes up at once (the extension's gm-shim.js has it before the
// page loads): some pages redirect a moment after they have loaded, before the settings are read.
if (calmSite && !EXT) calmRedirects(calmSite, () => !hostOff);
