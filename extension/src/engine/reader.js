// ───────────────────────────── Reader ─────────────────────────────
// Plain view opens an article in place: the page is fetched the way the browser would fetch it,
// and only its text, subheadings, quotes, lists and pictures are kept. Nothing from the page runs
// or is inserted as HTML.
// Paid articles (schema.org isAccessibleForFree: false) are never read in place unless you have said
// you subscribe to the site: many sites (VG) send the whole text to everyone and hide it in the
// browser, so the page itself can't tell us what you may read. Once you subscribe, you get what the
// site sends you, paywalled parts included (BT wraps the body in .paywall).
const READER_SKIP_FREE = ['script', 'style', 'noscript', 'template', 'nav', 'aside', 'footer', 'form', 'button', 'iframe', 'svg', 'dialog',
  '[role="complementary"]', '[role="navigation"]', '[aria-hidden="true"]', '[hidden]', '[data-ad]', '[id^="ad-" i]', '[id^="ad_" i]',
  ...['related', 'share', 'social', 'newsletter', 'advert', 'ad-slot', 'adslot', 'promo', 'recommend', 'comment', 'teaser', 'byline', 'breadcrumb', 'author']
    .map(c => `[class*="${c}" i]`)].join(', ');
const READER_SKIP = READER_SKIP_FREE + ', [class*="paywall" i], [data-paywall]';
const ALSO = /^(?:les også|les mer|se også|se video|hør også|mer om|read more|see also|related|lesen sie auch|mehr zum thema|auch interessant|les hele saken|kjøp abonnement|bli abonnent|allerede abonnent|subscribe to)\b/i;

function readerImage(img, base) {
  const src = img.getAttribute('src'), lazy = img.dataset.src || img.dataset.lazySrc || img.dataset.original;
  const set = img.getAttribute('srcset') || img.dataset.srcset || img.closest('picture')?.querySelector('source[srcset]')?.getAttribute('srcset') || '';
  // The largest candidate in a srcset ("a.jpg 320w, b.jpg 1024w"), else src.
  const best = set.split(',').map(s => s.trim().split(/\s+/)).filter(p => p[0]).sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0))[0]?.[0];
  for (const u of [best, lazy, src && !src.startsWith('data:') ? src : '']) {
    if (!u || /\.svg(?:[?#]|$)|placeholder|spacer|blank\.|1x1/i.test(u)) continue;
    const w = +img.getAttribute('width') || 0;
    if (w && w < 200) return '';
    try { const abs = new URL(u, base).href; if (/^https?:/.test(abs)) return abs; } catch {}
  }
  return '';
}

// The element that holds the most paragraph text: a paragraph counts fully for its parent, half for
// its grandparent, a third above that and so on for five levels, so a body whose paragraphs sit in
// separate wrappers (BBC: a nest of blocks per paragraph) still wins as a whole.
function readerRoot(doc, skip) {
  const score = new Map();
  for (const p of doc.querySelectorAll('p')) {
    if (p.closest(skip)) continue;
    const n = norm(p.textContent).length; if (n < 40) continue;
    for (let el = p.parentElement, i = 1; el && i <= 5; el = el.parentElement, i++) score.set(el, (score.get(el) || 0) + n / i);
  }
  let best = null, max = 0;
  for (const [el, s] of score) if (s > max) { max = s; best = el; }
  return best;
}

// → { blocks: [{ t: 'p'|'h'|'quote'|'list'|'img', text, items, src, caption }], date, byline, paid } or null
// subscribed: you subscribe to this site, so its paywalled parts are yours to read.
function readArticle(html, url, withImages, subscribed) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let paid = false, date = '', byline = '';
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      for (const it of [].concat(JSON.parse(s.textContent)['@graph'] || JSON.parse(s.textContent))) {
        if (!it || !/Article|NewsArticle|Report/i.test(String(it['@type']))) continue;
        if (it.isAccessibleForFree === false || /^false$/i.test(String(it.isAccessibleForFree))) paid = true;
        date ||= it.datePublished || '';
        byline ||= [].concat(it.author || []).map(a => norm(typeof a === 'string' ? a : a?.name)).filter(Boolean).slice(0, 3).join(', ');
      }
    } catch {}
  }
  date ||= doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') || doc.querySelector('time[datetime]')?.getAttribute('datetime') || '';
  if (paid && !subscribed) return { blocks: [], date, byline, paid };
  const skip = subscribed ? READER_SKIP_FREE : READER_SKIP;
  const root = readerRoot(doc, skip);
  if (!root) return null;
  const blocks = [];
  const lead = norm(doc.querySelector('meta[property="og:description"]')?.getAttribute('content'));
  const walk = el => {
    for (const c of el.children) {
      if (c.matches(skip)) continue;
      const tag = c.tagName;
      if (tag === 'P') {
        const t = norm(c.textContent);
        if (t && !ALSO.test(t) && t !== lead) blocks.push({ t: 'p', text: t });
      } else if (/^H[2-4]$/.test(tag)) {
        const t = norm(c.textContent); if (t && t.length < 200) blocks.push({ t: 'h', text: t });
      } else if (tag === 'BLOCKQUOTE') {
        const t = norm(c.textContent); if (t) blocks.push({ t: 'quote', text: t });
      } else if (tag === 'UL' || tag === 'OL') {
        const lis = [...c.children].filter(li => li.tagName === 'LI');
        // A list of nothing but links is a "read more" box, not part of the story.
        if (lis.length && !lis.every(li => norm(li.textContent) === norm(li.querySelector('a')?.textContent || '-'))) {
          const items = lis.map(li => norm(li.textContent)).filter(Boolean);
          if (items.length) blocks.push({ t: 'list', items, ordered: tag === 'OL' });
        }
      } else if (tag === 'FIGURE' || tag === 'IMG' || tag === 'PICTURE') {
        const img = tag === 'IMG' ? c : c.querySelector('img');
        const src = withImages && img ? readerImage(img, url) : '';
        if (src) blocks.push({ t: 'img', src, caption: norm(c.querySelector('figcaption')?.textContent) });
      } else walk(c);
    }
  };
  walk(root);
  // Headings with nothing after them are links to other stories (BBC's "more on this").
  while (blocks.length && blocks[blocks.length - 1].t === 'h') blocks.pop();
  // The story's own picture leads when the body has none of its own.
  if (withImages && !blocks.some(b => b.t === 'img')) {
    try {
      const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (og) blocks.unshift({ t: 'img', src: new URL(og, url).href, caption: '' });
    } catch {}
  }
  const words = blocks.reduce((n, b) => n + (b.text || '').length + (b.items || []).join(' ').length, 0);
  return words >= 200 ? { blocks, date, byline, paid } : null;
}

const readerCache = new Map();
async function fetchArticle(url, withImages, subscribed) {
  const ck = url + (subscribed ? ' +' : '');
  if (readerCache.has(ck)) return readerCache.get(ck);
  const domainOf = u => { try { return registrable(new URL(u, url).hostname); } catch { return ''; } };
  let out = null;
  try {
    const r = await gm.xhr({ url, headers: { Accept: 'text/html' } });
    const finalUrl = r.finalUrl || r.responseURL || '';
    if (r.status >= 200 && r.status < 400 && !(finalUrl && domainOf(finalUrl) && domainOf(finalUrl) !== domainOf(url)))
      out = readArticle(r.responseText, finalUrl || url, withImages, subscribed);
  } catch {}
  readerCache.set(ck, out);
  return out;
}
