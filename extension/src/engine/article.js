// ───────────────────────────── Calm article pages ─────────────────────────────
// On article pages at the plain levels, blocks of teasers for other articles ("Les også",
// "Mer fra", related, recommended) are hidden. Their articles are offered once after the article,
// collapsed, as a plain list; leads are fetched only when the reader opens it. A teaser block is
// the largest ancestor of a teaser link that holds no prose and no <h1>, so the article itself
// and links in its running text are never touched.
const hasProse = el => [...el.querySelectorAll('p')].some(p => norm(p.textContent).length > 150);
function articleBodyEl() {
  let best = null, most = 0;
  for (const el of document.querySelectorAll('article, main, [itemprop="articleBody"], [class*="article-body" i], [class*="articlebody" i]')) {
    const n = [...el.querySelectorAll('p')].filter(p => norm(p.textContent).length > 80).length;
    if (n > most) { most = n; best = el; }
  }
  return most >= 3 ? best : null;
}
const RELATED_CSS = `
  :host{all:initial;display:block;margin:24px 0;color:var(--fg);font:16px/1.45 -apple-system,system-ui,sans-serif;
    --bg:#fbfbf9;--fg:#1d1d1b;--muted:#5f635f;--line:#e2e2dd;--accent:#2f5f8f}
  @media (prefers-color-scheme: dark){:host{--bg:#1a1b1a;--fg:#e8e8e5;--muted:#a3a7a3;--line:#333532;--accent:#7fa8d6}}
  *{box-sizing:border-box;animation:none!important;transition:none!important}
  details{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
  summary{cursor:pointer;color:var(--muted);font-weight:600}
  summary:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  ol{list-style:none;margin:8px 0 0;padding:0}
  li{padding:10px 0;border-top:1px solid var(--line)}
  li a{color:var(--fg);text-decoration:none;font-weight:600;font-size:17px;line-height:1.3}
  li a:visited{color:var(--muted)} li a:hover{text-decoration:underline}
  li p{margin:4px 0 0;color:var(--muted);font-size:15px}
  li.pic{display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:12px;align-items:start}
  .pic-img{width:96px;height:64px;border-radius:6px;object-fit:cover;background:var(--line);display:block}
  .paid{display:inline-block;margin-left:6px;padding:0 5px;border:1px solid var(--line);border-radius:4px;font-size:12px;color:var(--muted);vertical-align:2px}`;
// Runs at load and again when the page adds blocks later (the Guardian loads "More on this
// story" as you scroll); new articles join the same list.
let related = null;
function calmArticle(withImages) {
  const body = related?.body || articleBodyEl();
  if (!body) return false;
  if (!related) {
    const st = document.createElement('style');
    st.textContent = '.cb-related-hidden{display:none!important}';
    document.head.appendChild(st);
    related = { body, withImages, items: new Map(), sh: null, ol: null, fetched: false };
  }
  const fresh = [];
  for (const a of document.querySelectorAll('a[href]')) {
    if (a.closest('.cb-related-hidden') || skipLink(a) || isInline(a) || body.querySelector('h1')?.contains(a)) continue;
    const url = isArticleLink(a), el = url && headlineEl(a);
    if (!el) continue;
    let b = a;
    while (b.parentElement && b.parentElement !== document.body && !hasProse(b.parentElement) && !b.parentElement.querySelector('h1')) b = b.parentElement;
    if (hasProse(b) || b.querySelector('h1')) continue;
    b.classList.add('cb-related-hidden');
    const key = url.replace(/[?#].*$/, ''), teaser = textOf(el);
    if (!related.items.has(key) && teaser.length >= CFG.minTeaserLen && !isAd(a) && !isGame(url, teaser) && !mutedTopicOf(url, teaser)) {
      const it = { url, key, teaser, img: teaserImage(a), paid: isPaid(a) };
      related.items.set(key, it); fresh.push(it);
    }
  }
  if (fresh.length) addRelated(fresh);
  return true;
}
function relatedFill(it, li) {
  const m = cache[it.key];
  if (m && !m.err && mutedTopicOf(it.url, it.teaser, m)) { li.remove(); return; }
  const { text, lead } = choose(it.teaser, m && !m.err ? cleanMeta(m, it.url) : null);
  li.querySelector('a').textContent = text;
  const p = li.querySelector('p'); p.textContent = lead; p.hidden = !lead;
  const im = li.querySelector('.pic-img'), src = im && (it.img || (m && !m.err && m.image) || '');
  if (src && im.getAttribute('src') !== src) im.src = src;
}
// Leads are fetched only once the reader opens the list, and for articles added after that.
async function relatedFetch(rows) {
  const todo = rows.filter(([it]) => !cache[it.key]);
  const worker = async () => { for (let r; (r = todo.shift());) { await getMeta(r[0].url); relatedFill(...r); } };
  await Promise.all(Array.from({ length: CFG.concurrency }, worker));
}
function addRelated(items) {
  if (!related.sh) {
    const host = document.createElement('div');
    host.id = 'declickbait-related';
    related.sh = host.attachShadow({ mode: 'open' });
    related.sh.innerHTML = `<style>${RELATED_CSS}</style><details><summary></summary><ol></ol></details>`;
    related.ol = related.sh.querySelector('ol');
    related.body.insertAdjacentElement('afterend', host);
    related.sh.querySelector('details').addEventListener('toggle', e => {
      if (!e.target.open || related.fetched) return;
      related.fetched = true;
      relatedFetch([...related.ol.children].map(li => [related.items.get(li.dataset.key), li]));
    });
  }
  const rows = [];
  for (const it of items) {
    const li = document.createElement('li'), a = document.createElement('a'), p = document.createElement('p');
    a.href = it.url; li.dataset.key = it.key;
    const text = related.withImages ? document.createElement('div') : li;
    text.append(a);
    if (it.paid) { const b = document.createElement('span'); b.className = 'paid'; b.textContent = T.paid; text.append(b); }
    text.append(p);
    if (related.withImages) {
      const im = document.createElement('img');
      im.className = 'pic-img'; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      im.addEventListener('error', () => im.removeAttribute('src'));
      li.className = 'pic'; li.append(text, im);
    }
    related.ol.append(li); rows.push([it, li]); relatedFill(it, li);
  }
  related.sh.querySelector('summary').textContent = `${T.related} (${related.ol.children.length})`;
  if (related.fetched) relatedFetch(rows);
}
