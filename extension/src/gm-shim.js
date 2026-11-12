// Gives declickbait.js the userscript-manager API it expects (GM.getValue, GM.setValue,
// GM.xmlHttpRequest, GM.info), backed by extension storage and a fetch in the background
// script, so the userscript runs unchanged as the content script. GM.exposeSettings is
// extension-only: the script hands over its settings handler, and the popup talks to it.
(() => {
  'use strict';
  const api = globalThis.browser ?? globalThis.chrome;
  // Times in ms since the page's navigation started, for finding out where a slow start goes. Marked here and by the
  // engine (mark() in env.js). A build made with WD_TIMING_URL (build.mjs) sends them to that address on this Mac.
  const marks = {}, mark = n => { if (!(n in marks)) marks[n] = Math.round(performance.now()); };
  globalThis.__wdMark = mark;
  mark('shim');
  document.addEventListener('readystatechange', () => mark('ready-' + document.readyState));
  document.addEventListener('DOMContentLoaded', () => mark('dcl'));
  document.addEventListener('visibilitychange', () => mark('visible-' + document.visibilityState));
  mark('start-' + document.visibilityState);
  const TIMING_URL = '@timing-url';
  if (TIMING_URL.startsWith('http')) {
    // Sent several times (the logger keeps the last per page): at 3, 8 and 25 s, 4 s after load, and when the tab is
    // hidden or left, so a page you leave before it has loaded still reports. With the slowest network requests so far.
    const id = Math.random().toString(36).slice(2, 8);
    // How long the page's main thread was busy: a 50 ms timer that comes late was held up by other work. Summed per 2 s
    // window for 40 s, with the longest single hold-up in each.
    const busy = [];
    let lastTick = performance.now();
    const ticker = setInterval(() => {
      const now = performance.now(), late = now - lastTick - 50; lastTick = now;
      const w = Math.floor(now / 2000); busy[w] ||= [0, 0];
      if (late > 20) { busy[w][0] += Math.round(late); busy[w][1] = Math.max(busy[w][1], Math.round(late)); }
      if (now > 40000) clearInterval(ticker);
    }, 50);
    const send = why => {
      const nav = performance.getEntriesByType('navigation')[0] || {}, res = performance.getEntriesByType('resource');
      const slow = res.filter(r => r.duration > 1500).sort((a, b) => b.duration - a.duration).slice(0, 6)
        .map(r => `${Math.round(r.startTime)}+${Math.round(r.duration)} ${r.initiatorType} ${r.name.slice(0, 90)}`);
      api.runtime.sendMessage({ type: 'wd-timing', url: TIMING_URL, data: { page: location.href, id, why, at: Math.round(performance.now()), ua: navigator.userAgent, ...marks,
        nav: { request: Math.round(nav.requestStart || 0), firstByte: Math.round(nav.responseStart || 0), lastByte: Math.round(nav.responseEnd || 0), load: Math.round(nav.loadEventStart || 0) },
        requests: res.length, unfinished: res.filter(r => !r.responseEnd).length, slow,
        busy: busy.map((b, i) => b && `${i * 2}s:${b[0]}/${b[1]}`).filter(Boolean).join(' ') } }).catch(() => {});
    };
    for (const t of [3000, 8000, 25000, 41000]) setTimeout(() => send(t / 1000 + 's'), t);
    window.addEventListener('load', () => setTimeout(() => send('load+4s'), 4000));
    document.addEventListener('visibilitychange', () => { if (document.hidden) send('hidden'); });
    window.addEventListener('pagehide', () => send('left'));
  }
  let settingsHandler = null;
  const fetches = { ok: 0, failed: 0 }; // shown in the popup, so a site that blocks fetches is visible

  // The settings in one read, as the page starts: Safari answers each storage call slowly while a heavy front page
  // loads, and the engine asks for a dozen of them one after another before it can lay out the list. Kept current
  // from storage.onChanged (the popup, other tabs) and from setValue below; read as copies, so a caller can't change it.
  // Only the settings: the article cache (cache_v2, about a megabyte) made this one read slow in Safari, which turns it
  // into JSON and sends it across to the page. A key not listed here is read when asked for.
  const SETTINGS = new Set(['calmParts', 'disabledHosts', 'display', 'enabledHosts', 'genericSites', 'includeLead', 'level',
    'mutedTopics', 'pausedHosts', 'plainHosts', 'plainLayout', 'plainSort', 'siteLevels', 'swipeAnimation']);
  let snap = api.storage.local.get([...SETTINGS]).catch(() => ({}));
  snap.then(() => mark('settings'));
  // On a news site the engine will want the cache: its read starts now too, beside the page, and is used once.
  const early = {};
  // The settings once they are here: GM.getValue answers from this object without waiting for a promise. In Safari each
  // wait on the extension's promise went through the page's task queue, about 50 ms on a busy front page, and the engine
  // asks for ten settings one after another before it starts: half a second on bt.no.
  let snapNow = null;
  snap.then(s => { snapNow = s; });
  const keep = (s, k, has, v) => { if (has) s[k] = v; else delete s[k]; };
  api.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    for (const k in ch) delete early[k];
    const apply = s => { for (const k in ch) if (SETTINGS.has(k)) keep(s, k, 'newValue' in ch[k], ch[k].newValue); return s; };
    if (snapNow) apply(snapNow); else snap = snap.then(apply);
  });
  const readOne = k => api.storage.local.get(k).catch(() => ({}));
  globalThis.GM = {
    info: { script: { name: api.runtime.getManifest().name, version: api.runtime.getManifest().version }, scriptHandler: 'Web Detox extension' },
    async getValue(k, d) {
      if (SETTINGS.has(k)) { const s = snapNow || await snap; return k in s ? structuredClone(s[k]) : d; }
      const got = early[k]; delete early[k];
      const s = got?.now || await (got?.read || readOne(k)); return k in s ? s[k] : d;
    },
    // Several settings in one call (the engine's start): one wait instead of one per setting.
    async getValues(defaults) {
      const s = snapNow || await snap, out = {};
      for (const k in defaults) out[k] = SETTINGS.has(k) ? (k in s ? structuredClone(s[k]) : defaults[k]) : await this.getValue(k, defaults[k]);
      return out;
    },
    async setValue(k, v) {
      delete early[k];
      if (SETTINGS.has(k)) { if (snapNow) snapNow[k] = structuredClone(v); else snap = snap.then(s => { s[k] = structuredClone(v); return s; }); }
      await api.storage.local.set({ [k]: v });
    },
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
  if (typeof listedHost === 'function' && listedHost(host)) {
    const e = early.cache_v2 = { read: readOne('cache_v2') };
    e.read.then(v => { e.now = v; }); // answered from here once it is in, without another wait (see snapNow)
  }
  // A calm site (calm-sites.js, put in below by build.mjs) gets its hide list and the guard against
  // redirects to the app at once, and loses them again if you chose Vanilla there.
  // @include calm-sites
  const calm = CALM_SITES.find(s => s.host.test(host));
  if (calm) {
    let on = true;
    const st = calmStyle(calm);
    (document.head || document.documentElement).appendChild(st);
    calmRedirects(calm, () => on);
    api.storage.local.get('disabledHosts').then(s => {
      if ((s.disabledHosts || []).includes(host)) { on = false; st.remove(); }
      if (calm.name === 'Snapchat') {
        // For snapchat-web.js, which runs in the page's world and can't read the settings.
        try { on ? localStorage.removeItem('nothis-vanilla') : localStorage.setItem('nothis-vanilla', '1'); } catch {}
        // On a phone the front page (/ or /nb-NO) only offers the app, and its Chat tab leads there.
        // Logged out, /web can send you back here (then with a referrer, to the login), so not twice in a row.
        if (on && host === 'snapchat.com' && /^\/(?:[a-z]{2}-[A-Z]{2}\/?)?$/.test(location.pathname) && /iPhone|iPad|iPod|Android/.test(navigator.userAgent)) try {
          if (Date.now() - (+sessionStorage.getItem('nothis-snap-web') || 0) > 30000) { sessionStorage.setItem('nothis-snap-web', Date.now()); location.replace('/web'); }
        } catch {}
      }
    });
    return;
  }
  try { if (sessionStorage.getItem('declickbait-original') === host || location.hash === '#nothis-original') return; } catch {} // "Original" or "Read on the site" was pressed
  let path = location.pathname; try { path = decodeURIComponent(path); } catch {}
  const front = /^\/(?:[\p{L}-]{1,30}\/?){0,2}$/u.test(path); // "/", "/sport", "/nyheter/innenriks": not an article
  let cover = null;
  const put = () => {
    if (cover) return;
    cover = document.createElement('style');
    cover.id = 'nothis-cover'; mark('cover');
    // opacity too: an element can make itself visible again (VG's timestamps), not opaque.
    // What is in the body is hidden, not the body: while a page loads, Safari (WebKit) paints nothing until the body is
    // visible, so a hidden body kept the screen blank, list and all, until the site's last ad had loaded (on nytimes.com
    // that could be never). See LocalFrameView::checkAndDispatchDidReachVisuallyNonEmptyState in WebKit.
    cover.textContent = 'html,html>body{background:#fbfbf9!important}html>body>*{visibility:hidden!important;opacity:0!important}@media (prefers-color-scheme: dark){html,html>body{background:#1a1b1a!important}}';
    (document.head || document.documentElement).appendChild(cover);
    setTimeout(() => cover.remove(), 12000);
  };
  // The list as it was at the last visit (plain.js keeps a copy): shown at once, until the engine has the list up again,
  // so a slow front page shows the headlines you saw last instead of a blank screen. A thin bar moves under the header
  // while it waits; its links are ordinary links. A day old at most, and gone after 20 s if the engine never starts.
  const shotKey = 'nothis-shot:' + location.pathname;
  let shot = null, shotEl = null;
  try { const s = JSON.parse(localStorage.getItem(shotKey) || 'null'); if (s?.html && Date.now() - s.at < 24 * 3600e3) shot = s; } catch {}
  // A heavy front page (plain.js marks it when it measures one: nytimes.com) is not loaded at all. Its own scripts froze
  // Safari for seconds at a time under the list, so a click waited; stopped here, before any of them arrive, the tab is
  // Web Detox's alone. The engine reads a downloaded copy of the page instead (plainView), and loads the page as usual
  // if that goes wrong. Only with a list from the last visit to show meanwhile, and never after "Original".
  let stopped = false;
  try {
    stopped = front && !!shot && Date.now() - (+localStorage.getItem('nothis-heavy') || 0) < 7 * 864e5 && sessionStorage.getItem('nothis-nostop') !== host;
    sessionStorage.removeItem('nothis-nostop');
  } catch {}
  if (stopped) {
    window.stop();
    globalThis.__wdStopped = true;
    const de = document.documentElement || document.appendChild(document.createElement('html'));
    if (!document.head) de.prepend(document.createElement('head'));
    if (!document.body) de.append(document.createElement('body'));
    // The site's own <meta name="viewport"> is often not parsed yet when the page is stopped, and without
    // one a phone lays the page out 980 px wide and shrinks it: the list ends up a narrow column.
    if (!document.querySelector('meta[name="viewport"]')) {
      const vp = document.createElement('meta');
      vp.name = 'viewport'; vp.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
      document.head.prepend(vp);
    }
    if (shot.title) document.title = shot.title;
  }
  if (front && shot) {
    put();
    shotEl = document.createElement('div');
    shotEl.id = 'nothis-shot';
    // You have the last word: Original works here too (the site as published, once), the other buttons wait for the list.
    const shotRoot = shotEl.attachShadow({ mode: 'open' });
    shotRoot.addEventListener('click', e => {
      if (!e.target.closest?.('[data-act="original"]')) return;
      try { sessionStorage.setItem('declickbait-original', host); } catch {}
      location.reload();
    });
    shotRoot.innerHTML = shot.html + `<style>.top button:not([data-act="original"]),nav,.keys{pointer-events:none;opacity:.45}
      header::after{content:"";position:absolute;left:0;bottom:-1px;width:30%;height:2px;background:var(--accent);animation:wait 1.1s ease-in-out infinite alternate}
      @keyframes wait{to{left:70%}}@media (prefers-reduced-motion: reduce){header::after{animation:none;width:100%;opacity:.5}}</style>`;
    document.documentElement.appendChild(shotEl); mark('copy');
    setTimeout(() => { if (!document.documentElement.hasAttribute('data-nothis-engine')) shotEl.remove(); }, 20000);
  }
  if (front && typeof listedHost === 'function' && listedHost(host)) put();
  snap.then(s => {
    const chosen = (s.siteLevels || {})[host], level = chosen || s.level || 'pictures'; // 'pictures' is the default level
    if ((level !== 'plain' && level !== 'pictures') || (s.disabledHosts || []).includes(host)) {
      cover?.remove(); shotEl?.remove();
      try { localStorage.removeItem(shotKey); } catch {}
      if (stopped) { try { sessionStorage.setItem('nothis-nostop', host); } catch {} location.reload(); }
      return;
    }
    if (chosen || (s.plainHosts || []).includes(host)) put();
  });
})();
