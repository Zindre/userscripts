// ==UserScript==
// @name         Declickbait
// @namespace    no.sedb.declickbait
// @version      1.3.0
// @description  Replaces clickbait teaser headlines with the article's own headline and lead, plus local cleanup rules. No API keys, no tracking.
// @author       Sindre Sørensen
// @license      MIT
// @homepageURL  https://github.com/Zindre/userscripts
// @supportURL   https://github.com/Zindre/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/Zindre/userscripts/main/declickbait.user.js
// @downloadURL  https://raw.githubusercontent.com/Zindre/userscripts/main/declickbait.user.js
// @mobile       true
// @match        *://*/*
// @noframes
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @connect      *
// ==/UserScript==

(() => {
  'use strict';

  // ───────────────────────────── Config ─────────────────────────────
  const CFG = {
    // 'auto'        → article <h1>/og:title if it is less baity than the teaser, else og:description
    // 'title'       → always the article's own headline
    // 'description' → always the article's lead/description
    mode: 'auto',
    fetch: true,             // fetch article pages for metadata (false = rules only)
    genericSites: true,      // run on hosts not listed in SITES (article-URL heuristic)
    excludeHosts: [],        // never run here, e.g. ['example.com']; the menu command "disable on this site" adds to a persisted list
    maxFetchesPerPage: 60,
    concurrency: 3,
    cacheTtlMs: 12 * 3600e3,
    cacheMax: 2500,
    maxLen: 170,             // truncate descriptions at sentence boundary below this
    fitLines: 2.5,           // for tiles with fitted headline sizes (VG): size the new text to about this many lines
    includeLead: true,       // show the article lead under the headline (smaller, normal weight); menu command toggles + remembers
    minTeaserLen: 8,
    marker: true,            // subtle left bar on rewritten headlines; hover shows the original
    hotkey: { key: 'U', alt: true, shift: true }, // Alt+Shift+U toggles original/rewritten
  };

  // Per-site config. `article` matches URLs worth fetching. `skip` = container selectors to ignore.
  const SITES = [
    { host: /(^|\.)vg\.no$/,          article: /\/i\/[A-Za-z0-9]{5,}/ },
    { host: /(^|\.)e24\.no$/,         article: /\/i\/[A-Za-z0-9]{5,}/ },
    { host: /(^|\.)bt\.no$/,          article: /\/i\/[A-Za-z0-9]{5,}/ },
    { host: /(^|\.)aftenposten\.no$/, article: /\/i\/[A-Za-z0-9]{5,}/ },
    { host: /(^|\.)ba\.no$/,          article: /\/[a-z0-9-]+\/[a-z]\/[A-Za-z0-9]{5,}/ },
    { host: /(^|\.)dagbladet\.no$/,   article: /\/\d{7,}\/?$/ },
    { host: /(^|\.)nrk\.no$/,         article: /-1\.\d{7,}$|\/artikkel\/[^\/]*\d{6,}$/ },
    { host: /(^|\.)tv2\.no$/,         article: /\/\d{7,}\/?$/ },
    { host: /(^|\.)nettavisen\.no$/,  article: /\/\d{6,}|\/[a-z-]{6,}\/[a-z0-9-]{10,}/ },
    { host: /(^|\.)dn\.no$/,          article: /\/\d-\d-\d{6,}$/ },
    // Sweden / Denmark / Germany
    { host: /(^|\.)aftonbladet\.se$/,  article: /\/a\/[A-Za-z0-9]{5,}/ },
    { host: /(^|\.)expressen\.se$/,    article: /^\/[a-z-]+\/(?:[a-z-]+\/)*[a-z0-9]+(-[a-z0-9]+){2,}-?\/?$/ },
    { host: /(^|\.)svt\.se$/,          article: /^\/nyheter\/(?!video\/)[a-z-]+\/[a-z0-9]+(-[a-z0-9]+){2,}/ },
    { host: /(^|\.)dr\.dk$/,           article: /^\/(?:nyheder|sporten)\/.+\/[a-z0-9]+(-[a-z0-9]+){2,}/ },
    { host: /(^|\.)ekstrabladet\.dk$/, article: /\/article\d{6,}\.ece|\/\d{7,}$/ },
    { host: /(^|\.)bild\.de$/,         article: /-[0-9a-f]{20,}$|\/[a-z0-9]+(-[a-z0-9]+){3,}/ },
    { host: /(^|\.)spiegel\.de$/,      article: /-a-[0-9a-f-]{20,}$|^\/[a-z]+\/(?:[a-z]+\/)?[a-z0-9]+(-[a-z0-9]+){3,}/ },
    { host: /(^|\.)welt\.de$/,         article: /\/(?:article|plus)[0-9a-f]{16,}\// },
    // UK / US
    { host: /(^|\.)bbc\.(com|co\.uk)$/, article: /\/(news|sport)\/[a-z0-9-]*\d{6,}|\/articles\/[a-z0-9]{10,}/ },
    { host: /(^|\.)theguardian\.com$/, article: /\/\d{4}\/[a-z]{3}\/\d{2}\// },
    { host: /(^|\.)dailymail\.(co\.uk|com)$/, article: /\/article-\d{6,}\// },
    { host: /(^|\.)thesun\.(co\.uk|ie)$/, article: /\/\d{7,}\// },
    { host: /(^|\.)mirror\.co\.uk$/,  article: /-\d{7,}$/ },
    { host: /(^|\.)independent\.co\.uk$/, article: /-b\d{6,}\.html$/ },
    { host: /(^|\.)telegraph\.co\.uk$/, article: /\/\d{4}\/\d{2}\/\d{2}\// },
    { host: /(^|\.)cnn\.com$/,         article: /\/\d{4}\/\d{2}\/\d{2}\// },
    { host: /(^|\.)nytimes\.com$/,     article: /\/\d{4}\/\d{2}\/\d{2}\/.+\.html$/ },
    { host: /(^|\.)washingtonpost\.com$/, article: /\/\d{4}\/\d{2}\/\d{2}\// },
    { host: /(^|\.)nypost\.com$/,      article: /\/\d{4}\/\d{2}\/\d{2}\// },
    { host: /(^|\.)foxnews\.com$/,     article: /^\/[a-z-]+\/[a-z0-9]+(-[a-z0-9]+){3,}$/ },
    { host: /(^|\.)huffpost\.com$/,    article: /\/entry\// },
    { host: /(^|\.)buzzfeed\.com$/,    article: /^\/[a-z0-9_]+\/[a-z0-9]+(-[a-z0-9]+){2,}/ },
    { host: /(^|\.)businessinsider\.com$/, article: /^\/[a-z0-9]+(-[a-z0-9]+){3,}/ },
    { host: /(^|\.)apnews\.com$/,      article: /\/article\// },
    { host: /(^|\.)reuters\.com$/,     article: /-\d{4}-\d{2}-\d{2}\/?$/ },
  ];
  // Unlisted hosts: numeric id, or a slug of 4+ words (optionally .html), on the same registrable domain.
  const GENERIC_ARTICLE = /(\/\d{5,}(\/|$|[?#]))|(\/[a-z0-9]+(-[a-z0-9]+){3,}(\.html?)?\/?($|[?#]))/i;
  const registrable = h => { const p = h.split('.'); return (p.length > 2 && /^(co|com|org|net|gov|ac|edu)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? p.slice(-3) : p.slice(-2)).join('.'); };
  const SKIP_CONTAINERS = 'nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"]';

  // Local rewrite rules, applied in order. Edit freely.
  const RULES = [
    // lead-in hooks:  "Se videoen: ..." / "Her er ..." / "Watch: ..." / "Schock: ..." / "Kolla: ..."
    [/^(?:se|sjekk|se videoen|se bildene|her er|dette er|dette skjer|nå|avslørt|avslører|sjokk|watch|look|video|pictured|in pictures|in photos|revealed|exclusive|breaking|just in|omg|wow|here'?s why|this is why|this is what|you won'?t believe|wait until you see|schock|unglaublich|so|hier|darum|deshalb|kolla|här är|därför|chock|sådan|derfor|se her|chok)\b[^:]{0,40}:\s*/i, ''],
    // trailing bait: "... – det skjedde" / "... - what happened next" / "... – was dann passierte"
    [/\s*[:–—-]\s*(?:det skjedde|se hva som skjedde|det som skjedde|resultatet|svaret overrasker|det er ikke det du tror|what happened next|the result|the answer|and it'?s not what you think|you'?ll be surprised|here'?s what happened|you need to see|the internet is|fans are losing it|everyone is saying|was dann passierte|das ergebnis|sie werden nicht glauben|det som hände|se resultatet|du kommer inte tro|se hvad der skete|det skete|du vil ikke tro)[^.]*$/i, ''],
    // parenthetical / bracketed teasers  "(VIDEO)" "[BILDER]" "(PHOTOS)"
    [/\s*[([](?:video|bilder|foto|se video|watch|photos?|pictures|gallery|pics|bildergalerie|bilder|billeder)[)\]]\s*/gi, ' '],
    // stray entities in metadata ("&nbsp;")
    [/&(?:nbsp|#160);/g, ' '],
    // paywall/brand badges read into the text: "VG+, ..." "E24+ ..."
    [/^[A-ZÆØÅ0-9]{1,4}\+\s*[,:]?\s*/, ''],
    // doubled quote dashes: "Navn: - - Sitat"
    [/(\s|:)[-–—]\s+[-–—]\s/g, '$1– '],
    // punctuation
    [/[!?]{2,}$/, m => m[0] === '?' ? '?' : ''],
    [/!$/, ''],
    [/\s*(?:…|\.{3})\s*$/, ''],
    [/^\s*[-–—•]\s*/, ''],
    // emoji / dingbats
    [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ''],
    [/\s{2,}/g, ' '],
  ];
  // Caps words kept as-is when un-shouting. Add your own.
  const ACRONYMS = new Set(['I', 'A', 'US', 'UK', 'EU', 'UN', 'FN', 'TV', 'AI', 'KI', 'PM', 'MP', 'MPs', 'CEO', 'NHS', 'FBI', 'CIA', 'NFL', 'NBA', 'MLB', 'NHL', 'NCAA', 'GOP', 'ISIS', 'IMF', 'WHO', 'NYC', 'LA', 'DC', 'NY', 'BBC', 'CNN', 'ABC', 'NBC', 'CBS', 'ESPN', 'HBO', 'ITV', 'NATO', 'UEFA', 'FIFA', 'NASA', 'COVID', 'OPEC', 'ASEAN', 'UNICEF', 'NASDAQ', 'GDPR', 'IKEA', 'BMW', 'VW', 'DNA', 'IQ', 'GPS', 'PDF', 'PC', 'iOS', 'MIT', 'UCLA', 'NOKAS', 'FHI', 'NHO', 'NRK', 'NAV', 'SSB', 'PST', 'USA', 'LO', 'UDI', 'UNE', 'NORAD', 'EM', 'VM', 'OL', 'SVT', 'SD', 'DR', 'DF', 'SF', 'AfD', 'CDU', 'CSU', 'SPD', 'FDP', 'DFB', 'ARD', 'ZDF', 'RTL', 'F1', 'MMA', 'UFC', 'WWE']);

  const VAGUE_OPENERS = /^(?:dette|denne|disse|derfor|slik|her|nå|hun|han|de|det|sånn|this|these|that|those|why|how|here|she|he|they|it|das|dies|diese|dieser|deshalb|darum|so|hier|er|sie|warum|wie|detta|därför|så här|hon|varför|hur|sådan|hvorfor|hvordan)\b/i;
  const TRIGGERS = /\b(?:sjokk|sjokkert|rystet|ryster|avslør\w*|hemmelig\w*|utrolig|knalltøff|grep|reager\w*|raser|slakter|hyller|tabbe|advar\w*|bryter tausheten|shock\w*|stunn\w*|reveal\w*|secret|insane|unbelievable|jaw-dropping|slam\w*|blast\w*|rip\w* into|breaks silence|bombshell|brutal|savage|destroy\w*|meltdown|explosive|chilling|heartbreaking|hilarious|mind-blowing|game-changer|nightmare|horrifying|terrifying|devastating|outrag\w*|fury|furious|erupts?|goes viral|obsessed|must-see|epic fail|bizarre|weird|genius|crazy|schock\w*|skandal|krass|unfassbar|irre|wahnsinn|enthüllt|geheim\w*|eklat|wirbel|zoff|knallhart|chock\w*|hemlig\w*|rasar|sågar|hyllar|otrolig\w*|larm\w*|chok\w*|afslør\w*|sabler|hylder|skandale|kaos)\b/i;

  // ───────────────────────────── Helpers ─────────────────────────────
  const host = location.hostname.replace(/^www\./, '');
  const site = SITES.find(s => s.host.test(host));
  if (!site && !CFG.genericSites) return;
  const articleRe = site ? site.article : GENERIC_ARTICLE;

  const gm = {
    async get(k, d) { try { return typeof GM !== 'undefined' && GM.getValue ? await GM.getValue(k, d) : d; } catch { return d; } },
    async set(k, v) { try { if (typeof GM !== 'undefined' && GM.setValue) await GM.setValue(k, v); } catch {} },
    xhr(opts) { return new Promise((res, rej) => {
      if (typeof GM === 'undefined' || !GM.xmlHttpRequest) return rej(new Error('no GM.xmlHttpRequest'));
      GM.xmlHttpRequest({ method: 'GET', timeout: 12000, onload: res, onerror: rej, ontimeout: rej, ...opts });
    }); },
  };

  const norm = s => (s || '').replace(/\s+/g, ' ').trim();

  function fixCase(s) {
    const CAPS = /^[A-ZÆØÅÄÖÜ]{3,}$/, ANYCAPS = /^[A-ZÆØÅÄÖÜ]+$/;
    const words = s.split(' ');
    const segs = w => w.replace(/[.,:!?'’"»]+$/, '').split('-');
    const capsWords = words.filter(w => segs(w).some(p => CAPS.test(p) && !ACRONYMS.has(p)));
    if (capsWords.length === 0) return s;
    const allCaps = capsWords.length >= Math.max(2, words.length * 0.6);
    return words.map((w, i) => {
      const punct = (w.match(/[.,:!?'’"»]+$/) || [''])[0];
      const out = segs(w).map(p => {
        if (ACRONYMS.has(p)) return p;
        if (allCaps ? !ANYCAPS.test(p) : (!CAPS.test(p) || p.length < 5)) return p;
        return p.toLowerCase();
      }).join('-') + punct;
      return i === 0 && /^[a-zæøå]/.test(out) ? out[0].toUpperCase() + out.slice(1) : out;
    }).join(' ');
  }

  function applyRules(s) {
    let out = norm(s);
    for (const [re, rep] of RULES) out = out.replace(re, rep);
    out = fixCase(norm(out));
    if (out && /^[a-zæøå]/.test(out)) out = out[0].toUpperCase() + out.slice(1);
    return out;
  }

  function baitScore(s) {
    if (!s) return 99;
    let n = 0;
    if (VAGUE_OPENERS.test(s)) n += 2;
    if (/[?:…]$|\.\.\.$/.test(s)) n += 2;
    if (/!/.test(s)) n += 1;
    if (/^[«"“].*[»"”]$/.test(s)) n += 2;               // quote-only teaser
    if (/\b[A-ZÆØÅ]{4,}\b/.test(s) && !ACRONYMS.has(s.match(/\b[A-ZÆØÅ]{4,}\b/)[0])) n += 1;
    n += (s.match(new RegExp(TRIGGERS.source, 'gi')) || []).length;
    if (s.split(' ').length <= 4) n += 1;                // too short to carry facts
    return n;
  }

  function truncate(s, max) {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const m = cut.match(/^(.*[.!?])\s/);
    if (m && m[1].length > max * 0.4) return m[1];
    return cut.replace(/\s+\S*$/, '') + '…';
  }

  // ───────────────────────────── Cache ─────────────────────────────
  let cache = null, cacheDirty = false;
  async function loadCache() {
    cache = (await gm.get('cache', {})) || {};
    const now = Date.now();
    for (const k in cache) if (now - cache[k].t > CFG.cacheTtlMs) { delete cache[k]; cacheDirty = true; }
  }
  const saveCache = (() => { let timer; return () => {
    if (!cacheDirty) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const keys = Object.keys(cache);
      if (keys.length > CFG.cacheMax) keys.sort((a, b) => cache[a].t - cache[b].t).slice(0, keys.length - CFG.cacheMax).forEach(k => delete cache[k]);
      await gm.set('cache', cache); cacheDirty = false;
    }, 1500);
  }; })();

  // ───────────────────────────── Article metadata ─────────────────────────────
  function extractMeta(html, url) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const q = sel => doc.querySelector(sel);
    const meta = (sel) => norm(q(sel)?.getAttribute('content'));
    let ldTitle = '', ldDesc = '';
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent);
        const items = [].concat(j['@graph'] || j);
        for (const it of items) {
          if (!it || !/Article|NewsArticle|Report/i.test(String(it['@type']))) continue;
          ldTitle = ldTitle || norm(it.headline); ldDesc = ldDesc || norm(it.description);
        }
      } catch {}
    }
    const h1 = norm(q('article h1, main h1, h1')?.textContent);
    const title = ldTitle || meta('meta[property="og:title"]') || h1 || norm(doc.title).replace(/\s*[|–-]\s*[^|–-]{2,30}$/, '');
    const desc = ldDesc || meta('meta[property="og:description"]') || meta('meta[name="description"]') || norm(q('article p, main p, [class*="lead"], [class*="ingress"], [class*="standfirst"]')?.textContent);
    return { title: norm(title), desc: norm(desc) };
  }

  const fetchCount = { n: 0 };
  async function getMeta(url) {
    const key = url.replace(/[?#].*$/, '');
    if (cache[key]) return cache[key];
    if (!CFG.fetch || fetchCount.n >= CFG.maxFetchesPerPage) return null;
    fetchCount.n++;
    try {
      const r = await gm.xhr({ url, headers: { Accept: 'text/html' } });
      if (r.status < 200 || r.status >= 400) throw new Error('HTTP ' + r.status);
      const m = extractMeta(r.responseText, url);
      cache[key] = { ...m, t: Date.now() }; cacheDirty = true; saveCache();
      return cache[key];
    } catch (e) {
      cache[key] = { title: '', desc: '', t: Date.now(), err: 1 }; cacheDirty = true; saveCache();
      return null;
    }
  }

  // ───────────────────────────── Choosing the replacement ─────────────────────────────
  function choose(teaser, meta) {
    const cleaned = applyRules(teaser);
    if (!meta) return { text: cleaned, lead: '' };
    const title = applyRules(meta.title), desc = meta.desc ? truncate(applyRules(meta.desc), CFG.maxLen) : '';
    const same = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();
    let text;
    if (CFG.mode === 'title') text = title || desc || cleaned;
    else if (CFG.mode === 'description') text = desc || title || cleaned;
    else {
      const tScore = baitScore(cleaned), aScore = baitScore(title);
      if (title && !same(title, cleaned) && aScore < tScore) text = title;
      else if (desc && tScore >= 2 && !same(desc, cleaned)) text = desc;
      else if (title && !same(title, cleaned) && aScore <= tScore) text = title;
      else text = cleaned;
    }
    // Lead: shown after the headline unless it is the headline or merely repeats it.
    let lead = '';
    if (CFG.includeLead && desc && !same(desc, text)) {
      const d = desc.toLowerCase(), t = text.toLowerCase().replace(/[.!?…]+$/, '');
      if (d.startsWith(t)) text = desc; else lead = desc;
    }
    return { text, lead };
  }

  // ───────────────────────────── DOM ─────────────────────────────
  const HEADLINE_SEL = 'h1, h2, h3, h4, [class*="title" i], [class*="headline" i], [class*="heading" i], [class*="tittel" i]';
  const seen = new WeakSet();
  const rewritten = new Set();
  let showOriginal = false;

  function isArticleLink(a) {
    let href;
    try { href = new URL(a.getAttribute('href'), location.href); } catch { return false; }
    if (!/^https?:$/.test(href.protocol)) return false;
    const h = href.hostname.replace(/^www\./, '');
    const target = SITES.find(s => s.host.test(h));
    if (target) { if (!target.article.test(href.pathname)) return false; }
    else if (site || registrable(h) !== registrable(host) || !articleRe.test(href.pathname)) return false;
    if (href.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '')) return false;
    return href.href;
  }

  // Visible teaser text. aria-label wins (VG/NRK put the un-hyphenated headline there);
  // innerText keeps a space at <br>/block boundaries where textContent would glue words.
  function textOf(el) {
    const al = norm(el.getAttribute && el.getAttribute('aria-label'));
    if (al && al.length >= CFG.minTeaserLen) return al;
    let t = '';
    try { t = norm(el.innerText); } catch {}
    return t || norm(el.textContent);
  }

  function headlineEl(a) {
    const ok = el => textOf(el).length >= CFG.minTeaserLen;
    const inner = [...a.querySelectorAll('h1, h2, h3, h4')].find(ok) || [...a.querySelectorAll(HEADLINE_SEL)].find(ok);
    if (inner) return inner;
    const outer = a.closest(HEADLINE_SEL);
    if (outer && outer.querySelectorAll('a').length === 1 && ok(a)) return a;
    return ok(a) && !a.querySelector('img, picture, video, svg') ? a : null;
  }

  const INLINE = new Set(['SPAN', 'BR', 'EM', 'STRONG', 'B', 'I', 'U', 'S', 'SMALL', 'MARK', 'SUP', 'SUB', 'WBR']);
  function setText(el, text, lead = '') {
    // Descend to the element that carries the text so wrappers/styles/images survive.
    // Stop above any child with a fitted (very different) font size, e.g. VG's per-line segments.
    const fs = x => parseFloat(getComputedStyle(x).fontSize) || 0;
    const base = fs(el);
    const fitted = x => base && (fs(x) > base * 1.3 || fs(x) < base * 0.7);
    let target = el;
    while (target.children.length === 1 && norm(target.textContent) === norm(target.children[0].textContent) && !fitted(target.children[0])) target = target.children[0];
    target.querySelector(':scope > .cb-lead')?.remove();
    // Fitted segments (VG) are sized to fill the tile with 1–3 words per line. Pick a size that
    // fits the new text in ~2.5 lines of the tile width, never larger than the original segments.
    if (!el.dataset.cbMaxSeg) {
      const segs = [...target.children].filter(fitted).map(fs);
      el.dataset.cbMaxSeg = segs.length ? Math.min(...segs) : 0;
    }
    const maxSeg = +el.dataset.cbMaxSeg;
    if (maxSeg) {
      const width = target.getBoundingClientRect().width || el.getBoundingClientRect().width || 300;
      const want = width * CFG.fitLines / (0.55 * Math.max(text.length, 10));
      target.style.fontSize = Math.round(Math.max(base, Math.min(maxSeg, want))) + 'px';
    }
    if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', lead ? text + ' – ' + lead : text);
    let ok = false;
    if (target.children.length === 0) { target.textContent = text; ok = true; }
    else {
      const nodes = [...target.childNodes].filter(n => n.nodeType === 3 && norm(n.textContent));
      if (nodes.length === 1 && norm(nodes[0].textContent) === norm(target.textContent)) { nodes[0].textContent = text; ok = true; }
      else if ([...target.children].every(c => INLINE.has(c.tagName))) { target.textContent = text; ok = true; }
    }
    if (ok && lead) {
      const sp = document.createElement('span');
      sp.className = 'cb-lead';
      sp.textContent = lead;
      target.appendChild(sp);
    }
    return ok;
  }

  function apply(el, orig, next, lead = '') {
    if (!next || (norm(next) === norm(orig) && !lead)) return;
    const first = !el.dataset.cbOrig;
    if (first) { el.dataset.cbOrig = el.innerHTML; el.dataset.cbOrigText = orig; el.dataset.cbOrigLabel = el.getAttribute('aria-label') || ''; }
    if (!showOriginal && !setText(el, next, lead)) { if (first) { delete el.dataset.cbOrig; delete el.dataset.cbOrigText; } return; }
    el.dataset.cbNew = next; el.dataset.cbLead = lead;
    el.title = 'Original: ' + el.dataset.cbOrigText;
    if (CFG.marker) el.classList.add('cb-rewritten');
    rewritten.add(el);
  }

  async function toggleLead() {
    CFG.includeLead = !CFG.includeLead;
    await gm.set('includeLead', CFG.includeLead);
    for (const el of rewritten) {
      if (!el.isConnected) { rewritten.delete(el); continue; }
      if (!showOriginal) setText(el, el.dataset.cbNew, CFG.includeLead ? el.dataset.cbLead || '' : '');
    }
  }

  function toggle() {
    showOriginal = !showOriginal;
    for (const el of rewritten) {
      if (!el.isConnected) { rewritten.delete(el); continue; }
      if (showOriginal) { el.innerHTML = el.dataset.cbOrig; if (el.dataset.cbOrigLabel) el.setAttribute('aria-label', el.dataset.cbOrigLabel); }
      else setText(el, el.dataset.cbNew, CFG.includeLead ? el.dataset.cbLead || '' : '');
    }
  }

  // Queue: visible items first, limited concurrency.
  const queue = [];
  let active = 0;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) {
      const i = queue.findIndex(j => j.el === e.target);
      if (i > 0) queue.unshift(...queue.splice(i, 1));
    }
    pump();
  }, { rootMargin: '200px' });

  async function pump() {
    while (active < CFG.concurrency && queue.length) {
      const job = queue.shift();
      active++;
      io.unobserve(job.el);
      (async () => {
        try {
          const meta = await getMeta(job.url);
          const orig = textOf(job.el);
          if (orig !== job.orig) return; // page changed it meanwhile
          const { text, lead } = choose(orig, meta);
          apply(job.el, orig, text, lead);
        } finally { active--; pump(); }
      })();
    }
  }

  function scan(root = document) {
    for (const a of root.querySelectorAll('a[href]')) {
      if (seen.has(a)) continue;
      seen.add(a);
      if (a.closest(SKIP_CONTAINERS)) continue;
      const url = isArticleLink(a);
      if (!url) continue;
      const el = headlineEl(a);
      if (!el || el.dataset.cbOrig) continue;
      const orig = textOf(el);
      if (orig.length < CFG.minTeaserLen) continue;
      if (/^\d[\d.,]*\s*k?\s*(?:comments?|kommentarer|shares?|delinger)$/i.test(orig)) continue; // "4.6k comments" links
      // instant local pass, then queue the fetch
      apply(el, orig, applyRules(orig));
      if (CFG.fetch) { queue.push({ el, url, orig: textOf(el) }); io.observe(el); }
    }
    pump();
  }

  // ───────────────────────────── Boot ─────────────────────────────
  async function main() {
    const disabled = (await gm.get('disabledHosts', [])) || [];
    const off = CFG.excludeHosts.some(h => host === h || host.endsWith('.' + h)) || disabled.includes(host);
    try {
      if (typeof GM !== 'undefined' && GM.registerMenuCommand) {
        GM.registerMenuCommand(off ? 'Declickbait: enable on ' + host : 'Declickbait: disable on ' + host, async () => {
          const next = off ? disabled.filter(h => h !== host) : [...disabled, host];
          await gm.set('disabledHosts', next);
          location.reload();
        });
      }
    } catch {}
    if (off) return;
    await loadCache();
    CFG.includeLead = await gm.get('includeLead', CFG.includeLead);
    if (CFG.marker) {
      const st = document.createElement('style');
      st.textContent = '.cb-rewritten{box-shadow:inset 3px 0 0 0 rgba(40,160,90,.75);padding-left:.25em}.cb-rewritten,.cb-rewritten *{white-space:normal!important;overflow-wrap:break-word;line-height:1.15}.cb-lead{display:block;margin-top:.35em;font-weight:normal;font-size:clamp(14px,.6em,20px);line-height:1.3;opacity:.85}';
      document.head.appendChild(st);
    }
    scan();
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => scan(), 400); })
      .observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', e => {
      const h = CFG.hotkey;
      if (e.key.toUpperCase() === h.key && !!e.altKey === !!h.alt && !!e.shiftKey === !!h.shift) { e.preventDefault(); toggle(); }
    });
    try {
      if (typeof GM !== 'undefined' && GM.registerMenuCommand) {
        GM.registerMenuCommand('Declickbait: toggle original/rewritten', toggle);
        GM.registerMenuCommand('Declickbait: toggle lead (ingress)', toggleLead);
      }
    } catch {}
  }
  main();
})();
