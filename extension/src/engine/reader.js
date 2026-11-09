// ───────────────────────────── Reader ─────────────────────────────
// Plain view opens an article in place: the page is fetched the way the browser would fetch it,
// and only its text, subheadings, quotes, lists and pictures are kept. Nothing from the page runs
// or is inserted as HTML. A quiz or poll has no text to keep, so it stays as the frame it is on the site.
// Paid articles: what the site sends is what you read, the same as the browser gets it. A logged-in
// subscriber gets the whole text, and so does everyone where the site sends it all (VG); a paywall
// is the publisher's to keep, not ours to add. When a paid article arrives short (the site held the
// rest back), the reader says the rest needs a subscription. Paywalled parts are read like the rest
// (BT wraps the body in .paywall).
// Short articles: a page that calls itself an article is shown however little text it has (a story
// that has just broken, "Saken oppdateres"), with a note that the site may have more; any other page
// needs a real body, or plain view sends the reader to the site (a video, live page or app).
const READER_SKIP = ['script', 'style', 'noscript', 'template', 'nav', 'aside', 'footer', 'form', 'button', 'iframe', 'svg', 'dialog',
  '[role="complementary"]', '[role="navigation"]', '[aria-hidden="true"]', '[hidden]', '[data-ad]', '[id^="ad-" i]', '[id^="ad_" i]',
  ...['related', 'share', 'social', 'newsletter', 'advert', 'ad-slot', 'adslot', 'promo', 'recommend', 'comment', 'teaser', 'byline', 'breadcrumb', 'author', 'reels']
    .map(c => `[class*="${c}" i]`)].join(', ');
// Live pages ("Nyheter direkte"): a running feed of short news, each entry a story of its own.
const LIVE_ENTRY = '[data-testid="liveblog-entry"], [itemtype$="/BlogPosting"]';
// A frame that is part of the story: a quiz, a poll or a survey (never an ad, a video or a social post).
const READER_EMBED = /quiz|\bpoll|survey|opinionstage|riddle\.com|playbuzz|apester|typeform|qualifio/i;
function readerEmbed(frame, base) {
  try {
    const src = new URL(frame.getAttribute('src') || frame.dataset.src || '', base);
    return src.protocol === 'https:' && READER_EMBED.test(src.href) ? src.href : '';
  } catch { return ''; }
}
// What a reader of the page sees of an element's text: no hidden copies. VG explains a word inside the
// word itself (<abbr title="…">mistenkt<span aria-hidden>mistenkt En person …</span></abbr>), and taken
// whole that reads "mistenktmistenktEn person …".
const HIDDEN_TEXT = 'script, style, noscript, template, button, svg, [aria-hidden="true"], [hidden], [role="tooltip"]';
function readerText(el) {
  if (!el.querySelector(HIDDEN_TEXT)) return norm(el.textContent);
  const c = el.cloneNode(true);
  for (const h of c.querySelectorAll(HIDDEN_TEXT)) h.remove();
  return norm(c.textContent);
}
// The words a paragraph explains (VG's word explanations, <abbr title>, <dfn title>): [{ w: word, n: what it means }].
function readerTerms(el) {
  const terms = [];
  for (const a of el.querySelectorAll('abbr[title], dfn[title]')) {
    const w = readerText(a), n = norm(a.getAttribute('title'));
    if (w && n && n.toLowerCase() !== w.toLowerCase() && !terms.some(t => t.w === w)) terms.push({ w, n });
  }
  return terms;
}
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

// → { blocks: [{ t: 'p'|'h'|'quote'|'list'|'img'|'embed', text, items, src, caption }], date, byline, paid, partial } or null
// partial: a paid article that arrived with only its start. short: an article with little text.
function readArticle(html, url, withImages) {
  const doc = parseHtml(html);
  let paid = false, date = '', byline = '', article = /article/i.test(doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || '');
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      for (const it of [].concat(JSON.parse(s.textContent)['@graph'] || JSON.parse(s.textContent))) {
        if (!it || !/Article|NewsArticle|Report/i.test(String(it['@type']))) continue;
        article = true;
        if (it.isAccessibleForFree === false || /^false$/i.test(String(it.isAccessibleForFree))) paid = true;
        date ||= it.datePublished || '';
        byline ||= [].concat(it.author || []).map(a => norm(typeof a === 'string' ? a : a?.name)).filter(Boolean).slice(0, 3).join(', ');
      }
    } catch {}
  }
  date ||= doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') || doc.querySelector('time[datetime]')?.getAttribute('datetime') || '';
  const skip = READER_SKIP;
  const root = readerRoot(doc, skip);
  // On a live page the most text is the feed as a whole, a jumble of unrelated stories. A link to one
  // entry (BT's ?pinnedEntry=…, the page then titled after it) reads as that entry alone, a proper
  // article however short; the feed itself reads entry by entry, each under its own heading.
  const live = [...doc.querySelectorAll(LIVE_ENTRY)].filter(e => !e.parentElement?.closest(LIVE_ENTRY));
  const title = norm(doc.querySelector('meta[property="og:title"]')?.getAttribute('content'));
  const entry = live.length > 1 && title && live.find(e => norm(e.querySelector('h1, h2, h3')?.textContent) === title);
  const feed = !entry && live.length > 1 && root && live.some(e => e.contains(root) || root.contains(e)) ? live.slice(0, 30) : null;
  if (entry) article = true;
  if (feed) date = ''; // the feed's own date is when it was started
  const quizzes = [...doc.querySelectorAll('article iframe, main iframe')].filter(f => readerEmbed(f, url));
  if (!root && !entry && !quizzes.length) return paid ? { blocks: [], date, byline, paid, partial: true } : article ? { blocks: [], date, byline, paid, partial: false, short: true } : null;
  const blocks = [];
  const lead = norm(doc.querySelector('meta[property="og:description"]')?.getAttribute('content'));
  const walk = el => {
    for (const c of el.children) {
      const tag = c.tagName;
      if (tag === 'IFRAME') { const src = readerEmbed(c, url); if (src) blocks.push({ t: 'embed', src }); continue; }
      if (c.matches(skip)) continue;
      // A link around a picture and text is a card for another story (BT's live entries end with one).
      if (tag === 'A' && c.querySelector('img') && !/\.(?:jpe?g|png|webp|avif|gif)(?:[?#]|$)/i.test(c.getAttribute('href') || '')) continue;
      if (tag === 'P') {
        const t = readerText(c);
        if (t && !ALSO.test(t) && t !== lead) {
          const terms = readerTerms(c);
          blocks.push(terms.length ? { t: 'p', text: t, terms } : { t: 'p', text: t });
        }
      } else if (/^H[2-4]$/.test(tag)) {
        const t = readerText(c); if (t && t.length < 200) blocks.push({ t: 'h', text: t });
      } else if (tag === 'BLOCKQUOTE') {
        const t = readerText(c); if (t) blocks.push({ t: 'quote', text: t });
      } else if (tag === 'UL' || tag === 'OL') {
        const lis = [...c.children].filter(li => li.tagName === 'LI');
        // A list of nothing but links is a "read more" box, not part of the story.
        if (lis.length && !lis.every(li => readerText(li) === norm(li.querySelector('a')?.textContent || '-'))) {
          const items = lis.map(readerText).filter(Boolean);
          if (items.length) blocks.push({ t: 'list', items, ordered: tag === 'OL' });
        }
      } else if (tag === 'FIGURE' || tag === 'IMG' || tag === 'PICTURE') {
        const img = tag === 'IMG' ? c : c.querySelector('img');
        const src = withImages && img ? readerImage(img, url) : '';
        if (src) blocks.push({ t: 'img', src, caption: (f => f ? readerText(f) : '')(c.querySelector('figcaption')) });
      } else walk(c);
    }
  };
  if (entry) walk(entry); else if (feed) feed.forEach(walk);
  else {
    if (root) walk(root);
    // A quiz can sit beside the element with the text (Amedia puts the week's quiz above it): keep that order.
    const above = [];
    for (const f of quizzes) {
      const src = readerEmbed(f, url);
      if (blocks.some(b => b.src === src)) continue;
      if (root && root.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_PRECEDING) above.push({ t: 'embed', src });
      else blocks.push({ t: 'embed', src });
    }
    blocks.unshift(...above);
  }
  // The entry's own heading is the reader's headline already.
  if (entry) for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].t === 'h' && blocks[i].text === title) blocks.splice(i, 1);
  // Headings with nothing after them are links to other stories (BBC's "more on this").
  while (blocks.length && blocks[blocks.length - 1].t === 'h') blocks.pop();
  // The story's own picture leads when the body has none of its own.
  if (withImages && !feed && !blocks.some(b => b.t === 'img')) {
    try {
      const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (og && !/logo/i.test(og)) blocks.unshift({ t: 'img', src: new URL(og, url).href, caption: '' });
    } catch {}
  }
  const words = blocks.reduce((n, b) => n + (b.text || '').length + (b.items || []).join(' ').length, 0);
  // A full article runs to thousands of characters; a paid one far shorter is what the site let through.
  if (paid && words < 1500) return { blocks: blocks.filter(b => b.t !== 'img' || words >= 200), date, byline, paid, partial: true };
  if (words >= 200) return { blocks, date, byline, paid, partial: false };
  return article ? { blocks, date, byline, paid, partial: false, short: !blocks.some(b => b.t === 'embed') } : null;
}

// Articles fetched so far (url → { at: when fetched, raw: promise of { html, finalUrl } or null,
// p: promise of readArticle's result }), so an article opens at once when it was fetched ahead.
// A page is only read (p) when it is about to be opened: reading every page fetched ahead on arrival
// kept the main thread busy, and a tap on the front page waited for it. Once read, raw points to the
// result instead of holding on to the page. readerFor is set while plain view is up; getMeta()
// hands over every article page it fetches anyway (articleFetched).
// A news story changes while the front page stays open (a stub grows into the full story), so plain
// view asks for a fresh copy (maxAge) when an article is about to be opened.
const readerCache = new Map();
let readerFor = false; // true while plain view is up
function articleFetched(url, html, finalUrl) {
  if (readerFor && !readerCache.has(url)) readerCache.set(url, { at: Date.now(), raw: Promise.resolve({ html, finalUrl }) });
}
const SAYS_ARTICLE = /"@type"\s*:\s*\[?\s*"\w*Article"|<meta[^>]*og:type[^>]*content="article"/;
async function fetchPage(url) {
  const domainOf = u => { try { return registrable(new URL(u, url).hostname); } catch { return ''; } };
  try {
    const r = await gm.xhr({ url, headers: { Accept: 'text/html' } });
    const finalUrl = r.finalUrl || r.responseURL || '';
    // A redirect to another domain is usually a login or a landing page. A paper can also send an article
    // on to a sister site (VG to Tek.no): that page says it is an article.
    const moved = finalUrl && domainOf(finalUrl) && domainOf(finalUrl) !== domainOf(url);
    if (r.status >= 200 && r.status < 400 && (!moved || SAYS_ARTICLE.test(r.responseText)))
      return { html: r.responseText, finalUrl };
  } catch {}
  return null;
}
// read false: only fetch ahead (resolves when the page is here), without reading it yet.
function fetchArticle(url, withImages, maxAge = Infinity, read = true) {
  let e = readerCache.get(url);
  if (!(Date.now() - e?.at <= maxAge)) readerCache.set(url, e = { at: Date.now(), raw: fetchPage(url) });
  if (!read) return e.raw;
  if (!e.p) { e.p = e.raw.then(r => { const art = r && readArticle(r.html, r.finalUrl || url, withImages); if (art) art.finalUrl = r.finalUrl; return art; }); e.raw = e.p; }
  return e.p;
}
