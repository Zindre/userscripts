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
  else if (newsHost(h)) { if (!genericArticlePath(href.pathname)) return false; }
  else if (site || registrable(h) !== registrable(host) || !genericArticlePath(href.pathname)) return false;
  if (href.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '')) return false;
  return href.href;
}

// Visible teaser text. innerText keeps a space at <br>/block boundaries where textContent
// would glue words; soft hyphens are dropped. aria-label is only a fallback: Schibsted sites
// prefix it with badge text ("Premium, …", "VG+, …") that is not on screen.
// innerText is empty while the page is hidden (the cover before plain view is up), so the last
// resort is the markup's text without what isn't text: style blocks, and copies hidden from screen
// readers (BA's headlines carry a <style> and each part twice, once aria-hidden, for an animation).
function textOf(el) {
  let t = '';
  try { t = norm(el.innerText.replace(/\u00AD/g, '')).replace(/\s*[▸▾]$/, ''); } catch {}
  if (t) return t;
  const al = norm(el.getAttribute && el.getAttribute('aria-label'));
  if (al) return al;
  const c = el.cloneNode(true);
  c.querySelectorAll('style, script, template, noscript').forEach(e => e.remove());
  const all = c.textContent;
  c.querySelectorAll('[aria-hidden="true"]').forEach(e => e.remove());
  return norm((norm(c.textContent) ? c.textContent : all).replace(/\u00AD/g, ''));
}

// A link is "inline" when its text-flow container has other words around it.
function isInline(a) {
  const box = a.closest('p, li, blockquote, dd, figcaption, td');
  if (!box || box.querySelector('h1, h2, h3, h4')) return false;
  const all = box.textContent;
  if (all.length > 3000) return false; // a container that big is a layout cell, not a sentence
  const rest = norm(all).replace(norm(a.textContent), '');
  return /(?:\p{L}+\s*){2,}/u.test(rest);
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
  // Size the new text to about CFG.fitLines lines of the tile width. Never larger than the
  // site's own size (or its fitted segments); never below 20px unless the site itself is smaller.
  const maxSeg = +el.dataset.cbMaxSeg;
  const width = target.getBoundingClientRect().width || el.getBoundingClientRect().width || 300;
  const want = width * CFG.fitLines / (0.55 * Math.max(text.length, 10));
  const cap = maxSeg || base;
  const size = Math.round(Math.max(Math.min(base, 20), Math.min(cap, want)));
  if (maxSeg || size < base) target.style.fontSize = size + 'px';
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
    if (!pushesLayout(sp, el)) sp.remove(); // fixed-height item: headline only
  }
  return ok;
}

// Did inserting `block` push the following content down? In lists with fixed-height items
// (live tickers, carousels) it does not, and the block would overlap the next item.
function pushesLayout(block, el) {
  const a = el.closest('a') || el;
  const card = a.closest('li, article') || a.parentElement;
  if (!card || !block.isConnected) return true;
  const r = block.getBoundingClientRect();
  if (!r.height) return true;
  // 1. the card must grow with the block (a fixed-height item does not)
  const withBlock = card.getBoundingClientRect().height;
  block.hidden = true;
  const without = card.getBoundingClientRect().height;
  block.hidden = false;
  if (withBlock - without < r.height - 2) return false;
  // 2. and the block must not lie on top of a sibling item (absolutely positioned lists)
  for (const sib of card.parentElement ? card.parentElement.children : []) {
    if (sib === card) continue;
    const sr = sib.getBoundingClientRect();
    if (sr.height && r.bottom > sr.top + 2 && r.top < sr.bottom - 2 && r.right > sr.left + 2 && r.left < sr.right - 2) return false;
  }
  return true;
}

function revealBlock(el) {
  let r = el.nextElementSibling;
  if (r && r.classList.contains('cb-reveal')) return r;
  r = document.createElement('span'); r.className = 'cb-reveal'; r.hidden = true;
  el.insertAdjacentElement('afterend', r);
  return r;
}
// 'reveal' and 'stack': the teaser stays; the article headline + lead go in a block underneath.
// reveal = block hidden until hover/tap; stack = block always visible.
function applyReveal(el, orig, next, lead) {
  const changed = norm(next) !== norm(orig), stack = CFG.display === 'stack';
  if (!changed && !lead) return;
  if (!el.dataset.cbOrigText) el.dataset.cbOrigText = orig;
  el.dataset.cbNew = next; el.dataset.cbLead = lead;
  if (!stack) el.title = [changed ? next : '', lead].filter(Boolean).join(' — ');
  if (CFG.marker) el.classList.add(stack ? 'cb-stack' : 'cb-hint');
  const r = revealBlock(el);
  if (stack) r.hidden = showOriginal;
  r.textContent = '';
  if (changed) { const b = document.createElement('b'); b.textContent = next; r.appendChild(b); }
  if (lead) { if (changed) r.appendChild(document.createElement('br')); r.appendChild(document.createTextNode(lead)); }
  if (stack && !r.hidden && !pushesLayout(r, el)) {
    // fixed-height item: fall back to tooltip only, no block
    r.remove(); el.title = [changed ? next : '', lead].filter(Boolean).join(' — ');
    el.classList.remove('cb-stack'); if (CFG.marker) el.classList.add('cb-hint');
    return;
  }
  if (!stack && !el.querySelector(':scope .cb-btn')) {
    const btn = document.createElement('span');
    btn.className = 'cb-btn'; btn.textContent = '▸'; btn.setAttribute('role', 'button'); btn.setAttribute('aria-label', 'Show article headline and lead');
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); r.hidden = !r.hidden; btn.textContent = r.hidden ? '▸' : '▾'; });
    el.appendChild(btn);
  }
  rewritten.add(el);
}

function apply(el, orig, next, lead = '') {
  if (!next) return;
  if (CFG.display === 'reveal' || CFG.display === 'stack') return applyReveal(el, orig, next, lead);
  if (norm(next) === norm(orig) && !lead) {
    if (el.dataset.cbOrig) { el.innerHTML = el.dataset.cbOrig; if (el.dataset.cbOrigLabel) el.setAttribute('aria-label', el.dataset.cbOrigLabel); el.classList.remove('cb-rewritten'); el.removeAttribute('title'); delete el.dataset.cbOrig; delete el.dataset.cbNew; delete el.dataset.cbLead; rewritten.delete(el); }
    return;
  }
  const first = !el.dataset.cbOrig;
  if (first) { el.dataset.cbOrig = el.innerHTML; el.dataset.cbOrigText = orig; el.dataset.cbOrigLabel = el.getAttribute('aria-label') || ''; }
  if (!showOriginal && !setText(el, next, lead)) { if (first) { delete el.dataset.cbOrig; delete el.dataset.cbOrigText; } return; }
  el.dataset.cbNew = next; el.dataset.cbLead = lead;
  el.title = 'Original: ' + el.dataset.cbOrigText;
  if (CFG.marker) el.classList.add('cb-rewritten');
  rewritten.add(el);
}

function toggle() {
  showOriginal = !showOriginal;
  for (const el of rewritten) {
    if (!el.isConnected) { rewritten.delete(el); continue; }
    if (CFG.display === 'reveal' || CFG.display === 'stack') {
      const r = el.nextElementSibling, btn = el.querySelector(':scope .cb-btn');
      // reveal: hotkey opens all; stack: hotkey hides all
      if (r && r.classList.contains('cb-reveal')) { r.hidden = CFG.display === 'stack' ? showOriginal : !showOriginal; if (btn) btn.textContent = r.hidden ? '▸' : '▾'; }
      continue;
    }
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
        if (job.inline) {
          const m = cleanMeta(meta, job.url);
          const t = m?.title ? applyRules(m.title) : '', d = m?.desc ? truncate(applyRules(m.desc), CFG.maxLen) : '';
          if (t.split(' ').length < 2 && !d) return;
          const tip = [t.split(' ').length < 2 ? '' : t, d].filter(Boolean).join(' — ');
          if (tip && tip.toLowerCase() !== orig.toLowerCase()) { job.el.title = tip; job.el.classList.add('cb-inline'); }
          return;
        }
        const topic = job.a && mutedTopicOf(job.url, orig, meta);
        if (topic) { muteTeaser(job.a, topic); return; }
        jobs.set(job.el, { orig, url: job.url, key: job.url.replace(/[?#].*$/, '') });
        const { text, lead } = choose(orig, cleanMeta(meta, job.url));
        apply(job.el, orig, text, lead);
      } finally { active--; pump(); }
    })();
  }
}

// Cooperative scan: new anchors are processed in slices so a page with thousands of links
// (or one that mutates constantly) never has its main thread held for long.
let scanning = false, rescan = false;
function scan(root = document) {
  if (!site && !hostEnabled && !isPublication()) return; // unlisted host that does not look like a publication (yet)
  if (scanning) { rescan = true; return; }
  scanning = true;
  const pending = [...root.querySelectorAll('a[href]')].filter(a => !seen.has(a));
  const slice = () => {
    const t0 = performance.now();
    let n = 0;
    while (pending.length && n < CFG.scanChunk && performance.now() - t0 < 12) { scanOne(pending.shift()); n++; }
    if (pending.length) { setTimeout(slice, 0); return; }
    scanning = false; pump();
    if (rescan) { rescan = false; scan(); }
  };
  slice();
}
function scanOne(a) {
  {
    seen.add(a);
    if (skipLink(a) || a.closest('.cb-related-hidden')) return;
    const url = isArticleLink(a);
    if (!url) return;
    const el = headlineEl(a);
    if (!el || el.dataset.cbOrig || el.dataset.cbInline) return;
    const orig = textOf(el);
    if (orig.length < CFG.minTeaserLen) return;
    if (/^\d[\d.,]*\s*k?\s*(?:comments?|kommentarer|shares?|delinger)$/i.test(orig)) return; // "4.6k comments" links
    if (isInline(a) && CFG.inlineLinks !== 'rewrite') {
      // Part of a sentence: never rewrite. Tooltip with the article's headline + lead instead.
      if (CFG.inlineLinks === 'tooltip' && CFG.fetch) { el.dataset.cbInline = '1'; queue.push({ el, url, orig, inline: true }); io.observe(el); }
      return;
    }
    const topic = mutedTopicOf(url, orig);
    if (topic) { muteTeaser(a, topic); return; } // never fetched: the reader doesn't want it
    // instant local pass, then queue the fetch
    apply(el, orig, applyRules(orig));
    if (CFG.fetch) { queue.push({ el, a, url, orig: textOf(el) }); io.observe(el); }
  }
}
