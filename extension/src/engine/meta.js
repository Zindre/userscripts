// ───────────────────────────── Cache ─────────────────────────────
const CACHE_KEY = 'cache_v2'; // bumped in 1.7.3: entries stored before the cross-site guard may be polluted
let cache = null, cacheDirty = false;
async function loadCache() {
  cache = (await gm.get(CACHE_KEY, {})) || {};
  const now = Date.now();
  for (const k in cache) if (now - cache[k].t > CFG.cacheTtlMs) { delete cache[k]; cacheDirty = true; }
}
const saveCache = (() => { let timer; return () => {
  if (!cacheDirty) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const stored = (await gm.get(CACHE_KEY, {})) || {};   // other tabs may have added entries meanwhile
    const now = Date.now();
    for (const k in stored) if (!(k in cache) && now - stored[k].t <= CFG.cacheTtlMs) cache[k] = stored[k];
    const keys = Object.keys(cache);
    if (keys.length > CFG.cacheMax) keys.sort((a, b) => cache[a].t - cache[b].t).slice(0, keys.length - CFG.cacheMax).forEach(k => delete cache[k]);
    await gm.set(CACHE_KEY, cache); cacheDirty = false;
  }, 1500);
}; })();

// ───────────────────────────── Article metadata ─────────────────────────────
function extractMeta(html, url) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const q = sel => doc.querySelector(sel);
  const meta = (sel) => norm(q(sel)?.getAttribute('content'));
  let ldTitle = '', ldDesc = '', ldImage = '', ldSection = '', ldKeywords = '';
  const imageOf = v => typeof v === 'string' ? v : Array.isArray(v) ? imageOf(v[0]) : (v && (v.url || v.contentUrl)) || '';
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.textContent);
      const items = [].concat(j['@graph'] || j);
      for (const it of items) {
        if (!it || !/Article|NewsArticle|Report/i.test(String(it['@type']))) continue;
        ldTitle = ldTitle || norm(it.headline); ldDesc = ldDesc || norm(it.description); ldImage = ldImage || imageOf(it.image);
        ldSection = ldSection || [].concat(it.articleSection || []).join(', '); ldKeywords = ldKeywords || [].concat(it.keywords || []).join(', ');
      }
    } catch {}
  }
  const h1 = norm(q('article h1, main h1, h1')?.textContent);
  const title = ldTitle || meta('meta[property="og:title"]') || h1 || norm(doc.title).replace(/\s*[|–-]\s*[^|–-]{2,30}$/, '');
  // Fallback lead: the first paragraph-like element that reads as prose, never nav/skip-link text.
  const prose = t => t.length >= 40 && t.length <= 600 && /[.!?…»"]/.test(t) && !/^(hopp til|skip to|gå til|til hovedinnhold|jump to)/i.test(t) && (t.match(/[a-zæøåäöü] [a-zæøåäöü]/g) || []).length >= 4;
  let fallback = '';
  for (const el of doc.querySelectorAll('article p, main p, [class*="lead"], [class*="ingress"], [class*="standfirst"]')) { const t = norm(el.textContent); if (prose(t)) { fallback = t; break; } }
  const desc = ldDesc || meta('meta[property="og:description"]') || meta('meta[name="description"]') || fallback;
  const self = meta('meta[property="og:url"]') || norm(q('link[rel="canonical"]')?.getAttribute('href'));
  let image = meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]') || ldImage;
  try { image = image ? new URL(image, url).href : ''; } catch { image = ''; }
  // The publisher's own labels, used by the topic filter: section and keywords.
  const sec = meta('meta[property="article:section"]') || norm(ldSection);
  const tags = [...doc.querySelectorAll('meta[property="article:tag"]')].map(m => norm(m.getAttribute('content')))
    .concat((meta('meta[name="keywords"]') || ldKeywords).split(',').map(norm)).filter(Boolean).slice(0, 20);
  // og:title often carries a section or site suffix (Bild: "… | News").
  return { title: norm(title).replace(/\s+\|\s+[^|]{2,25}$/, ''), desc: norm(desc), self, image, sec, tags };
}

// Site-wide boilerplate ("Fædrelandsvennen - Få siste nytt fra …") shows up as the title or
// description of paywalled or shell pages. It is generic if it equals the front page's own
// metadata, or if two different articles return the same text.
const pageMeta = (() => {
  const m = sel => norm(document.querySelector(sel)?.getAttribute('content'));
  return { title: m('meta[property="og:title"]') || norm(document.title), desc: m('meta[property="og:description"]') || m('meta[name="description"]'),
    site: m('meta[property="og:site_name"]') };
})();
const seenText = new Map();   // text -> Set of article urls
const generic = new Set();
function isGeneric(text, url) {
  if (!text) return false;
  const t = text.toLowerCase();
  if (generic.has(t)) return true;
  if (t === pageMeta.title.toLowerCase() || t === pageMeta.desc.toLowerCase() || (pageMeta.site && t === pageMeta.site.toLowerCase())) { generic.add(t); return true; }
  const urls = seenText.get(t) || new Set(); urls.add(url); seenText.set(t, urls);
  if (urls.size >= 2) { generic.add(t); refreshGeneric(t); return true; }
  return false;
}
function cleanMeta(m, url) {
  if (!m) return m;
  return { ...m, title: isGeneric(m.title, url) ? '' : m.title, desc: isGeneric(m.desc, url) ? '' : m.desc };
}
// A text just turned out to be generic: redo the headlines that already used it.
function refreshGeneric(t) {
  for (const [el, job] of jobs) {
    if (!el.isConnected) { jobs.delete(el); continue; }
    const m = cache[job.key];
    if (!m || (norm(m.title).toLowerCase() !== t && norm(m.desc).toLowerCase() !== t)) continue;
    const { text, lead } = choose(job.orig, cleanMeta(m, job.url));
    apply(el, job.orig, text, lead);
  }
}
const jobs = new Map();       // el -> { orig, url, key }

const fetchCount = { n: 0 };
async function getMeta(url) {
  const key = url.replace(/[?#].*$/, '');
  if (cache[key]) return cache[key];
  if (!CFG.fetch || fetchCount.n >= CFG.maxFetchesPerPage) return null;
  fetchCount.n++;
  const domainOf = u => { try { return registrable(new URL(u, url).hostname); } catch { return ''; } };
  try {
    const r = await gm.xhr({ url, headers: { Accept: 'text/html' } });
    if (r.status < 200 || r.status >= 400) throw new Error('HTTP ' + r.status);
    // Guard against a response that belongs to another request (seen with concurrent tabs in
    // Userscripts.app): the final URL and the page's own og:url/canonical must be on our domain.
    const finalUrl = r.finalUrl || r.responseURL || '';
    if (finalUrl && domainOf(finalUrl) && domainOf(finalUrl) !== domainOf(url)) return null;
    if (!site && finalUrl) { try { if (!genericArticlePath(new URL(finalUrl).pathname)) return null; } catch {} } // redirected to login/landing
    const m = extractMeta(r.responseText, url);
    if (m.self && domainOf(m.self) && domainOf(m.self) !== domainOf(url)) return null;
    cache[key] = { title: m.title, desc: m.desc, image: m.image, sec: m.sec, tags: m.tags, t: Date.now() }; cacheDirty = true; saveCache();
    articleFetched(url, r.responseText, finalUrl); // plain view keeps it, so the article opens at once
    return cache[key];
  } catch (e) {
    cache[key] = { title: '', desc: '', t: Date.now(), err: 1 }; cacheDirty = true; saveCache();
    return null;
  }
}
