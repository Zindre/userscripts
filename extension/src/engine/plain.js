// ───────────────────────────── Plain view ─────────────────────────────
// Level "plain" swaps a front page for a calm page of our own: the site's articles grouped by
// section, headline and lead only, in the editors' order. The site's <body> is hidden and its
// media paused, so ads, autoplay video, pop-ups and animation never show. A "Latest" section
// comes from the site's RSS/Atom feed. Article pages are left alone (they get the synopsis
// level). Paywalls stay: paid articles are marked and open on the site as usual.
const NB = /^(nb|nn|no)\b/i.test(document.documentElement.lang || '');
const T = NB
  ? { siteOrder: 'Avisens rekkefølge', byImportance: 'Viktigst først', top: 'Toppsak', important: 'Viktig', related: 'Relaterte saker', latest: 'Siste', other: 'Annet', sections: 'Seksjoner', original: 'Original', done: 'Ferdig', paid: 'Abonnement', count: n => `${n} saker`, up: 'Flytt opp', down: 'Flytt ned' }
  : { siteOrder: 'Site order', byImportance: 'Most important first', top: 'Top story', important: 'Important', related: 'Related articles', latest: 'Latest', other: 'Other', sections: 'Sections', original: 'Original', done: 'Done', paid: 'Subscription', count: n => `${n} articles`, up: 'Move up', down: 'Move down' };
const NOT_SECTION = /^(?:i|a|s|article|articles|artikkel|story|stories|amp|www|entry|news-story|content)$/i;
// Commercial sections (advertorials, affiliate shopping) are swallowed like the ads.
const AD_SECTION = /^(?:brand-?stories|brand-?studio|brandstudio|partner|partnerinnhold|partner-content|sponsored|sponset|annonse|annons|annonsorinnhold|mainos|anzeige|kaufberater|bons-plans|shopping|shoppingtips|deals|coupons|codes-promo|gutscheine|rabattkoder|tilbud|kaufkompass|vergleich)$/i;
// First path segment that names a section, skipping dates (/2026/10/24/politics/… → politics)
// and wrapper segments (FAZ: /aktuell/politik/… → politik).
const WRAPPER = /^(?:aktuell|aktuelles)$/i;
function sectionOf(url) {
  try {
    for (const sg of new URL(url).pathname.split('/').filter(Boolean).slice(0, -1)) {
      if (/^\d+$/.test(sg) || WRAPPER.test(sg)) continue;
      return /^[a-zæøåäöü][a-zæøåäöü-]{1,24}$/.test(sg) && !NOT_SECTION.test(sg) ? sg : 'other';
    }
  } catch {}
  return 'other';
}
// The site's own name for a section, from a menu link to it ("/vestfoldogtelemark" → "Vestfold og Telemark").
const sectionNames = new Map();
// Menu links first: their text is the section's name, where body links say "see all …".
function readSectionNames() {
  const links = [...document.querySelectorAll('a[href]')];
  for (const a of [...links.filter(a => a.closest(SKIP_CONTAINERS)), ...links.filter(a => !a.closest(SKIP_CONTAINERS))]) {
    let u; try { u = new URL(a.href); } catch { continue; }
    const m = u.pathname.replace(/^\/(?:aktuell|aktuelles)(?=\/.)/i, '').match(/^\/([^/]+)\/?$/);
    // "voir toute l'actu Société", "See all Sport", "Alle Nyheter" → the section name only
    const t = norm(a.textContent).replace(/^(?:voir (?:toute )?l['’]actu|voir tou(?:te)?s? les|tous les|toutes les|see all|view all|more from|se alle|alle|mer fra|mehr aus|mehr)\s+/i, '').replace(/^\p{Ll}/u, c => c.toUpperCase());
    const id = m && m[1].toLowerCase(), had = id && sectionNames.get(id);
    if (m && registrable(u.hostname) === registrable(host) && t.length >= 2 && t.length <= 30 && !had) sectionNames.set(id, t);
  }
}
const sectionLabel = id => id === 'latest' ? T.latest : id === 'other' ? T.other : sectionNames.get(id) || (id[0].toUpperCase() + id.slice(1)).replace(/-/g, ' ');
// Advertorials dressed as articles carry a small label; plain view leaves them out with the other ads.
const AD_LABEL = /^(?:annonse|annons|annonsørinnhold|annonsorinnhold|sponset|sponsrat|sponsoreret|sponsored|sponsored content|anzeige|werbung|advertisement|advertorial|reklame|paid post|partner content|i samarbeid med\b.*|i samarbete med\b.*|in partnership with\b.*)$/i;
function isAd(a) {
  const card = a.closest('article, li') || a;
  if (card.textContent.length > 2000) return false; // a whole column, not one teaser
  for (const el of card.querySelectorAll('span, div, p, small, strong, em, b, i')) {
    if (el.children.length) continue;
    const t = norm(el.textContent);
    if (t.length < 60 && AD_LABEL.test(t)) return true;
  }
  return false;
}
const PAID_LABEL = /^(?:[A-ZÆØÅ0-9]{1,8}\+|premium|pluss?|abo|subscriber|exclusive)\b/i;
function isPaid(a) {
  if (PAID_LABEL.test(norm(a.getAttribute('aria-label')))) return true;
  // Schibsted (VG, Aftenposten, BT, E24): data-track-access-level="Free" | "Paid" on the teaser.
  const access = a.closest('[data-track-access-level]')?.dataset.trackAccessLevel || a.querySelector('[data-track-access-level]')?.dataset.trackAccessLevel;
  if (access) return !/^free$/i.test(access);
  const card = a.closest('article, li') || a;
  return !!card.querySelector('[class*="premium" i], [class*="paywall" i], [data-paywall], [class*="plus-badge" i], [class*="plus-icon" i], [class*="pluss" i]');
}

// Puzzles, quizzes and horoscopes are not news. Matched on the URL (BT: /kultur/i/…/hjernetrim-sudoku)
// and on the start of the teaser ("Hjernetrim: …", "Quiz: …").
const GAME_URL = /(?:^|[/_-])(?:hjernetrim|kryssord|minikryss|helgekryss|sudoku|k-doku|ordjakten|quiz|quizzes|horoskop|horoscopes?|crosswords?|wordle|puzzles?|raetsel|kreuzwortraetsel|korsord|krydsord|tankenott)(?:[/_.-]|$)/i;
const GAME_TEASER = /^(?:hjernetrim|dagens (?:kryssord|quiz|sudoku|horoskop)|kryssord|sudoku|quiz|horoskop|horoscope|crossword|wordle|rätsel|kreuzworträtsel|korsord|krydsord|tankenøtt)\b/i;
const isGame = (url, teaser) => CFG.plainSkipGames && (GAME_URL.test(new URL(url).pathname) || GAME_TEASER.test(teaser || ''));

// The teaser's own picture: the first real image in the link, or in its card when the card
// holds just this teaser. Icons, badges and logos (narrower than 80px) and SVGs don't count.
function teaserImage(a) {
  const card = a.closest('article, li');
  const imgs = [...a.querySelectorAll('img'), ...(card && card.querySelectorAll('a[href]').length <= 3 ? card.querySelectorAll('img') : [])];
  for (const img of imgs) {
    const src = img.currentSrc || img.src || img.dataset.src || (img.getAttribute('srcset') || img.dataset.srcset || '').trim().split(/\s+/)[0];
    if (!src || src.startsWith('data:') || /\.svg(?:[?#]|$)/i.test(src)) continue;
    const w = img.naturalWidth || +img.getAttribute('width') || 0;
    if (w && w < 80) continue;
    try { return new URL(src, location.href).href; } catch {}
  }
  return '';
}

// How loudly the front page presents a teaser: the largest font size in its headline, the area of
// its card and how high up it sits. Measured before plain view hides the page.
function prominence(a, el) {
  let fs = 0;
  for (const x of [el, ...el.querySelectorAll('*')].slice(0, 30)) fs = Math.max(fs, parseFloat(getComputedStyle(x).fontSize) || 0);
  const r = (a.closest('article') || a).getBoundingClientRect();
  return { fs, area: r.width * r.height, y: r.top + scrollY };
}
// Score = headline size (half), how high up (35 %) and card size (15 %; feature boxes are large but
// not necessarily important), each relative to the page.
// Tier 3 = the top ~8 % (top stories), tier 2 = the next ~22 %, tier 1 = the rest.
function rankItems(items) {
  const median = xs => { const v = xs.filter(x => x > 0).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] || 1; };
  const mFs = median(items.map(it => it.m.fs)), mArea = median(items.map(it => it.m.area));
  [...items].sort((a, b) => a.m.y - b.m.y).forEach((it, i) => { it.posRank = i; });
  for (const it of items)
    it.score = 0.5 * ((it.m.fs || mFs) / mFs) + 0.15 * Math.sqrt((it.m.area || mArea) / mArea) + 0.35 * (1 - it.posRank / items.length);
  const top = Math.max(1, Math.round(items.length * 0.08)), high = Math.round(items.length * 0.3);
  [...items].sort((a, b) => b.score - a.score).forEach((it, i) => { it.tier = i < top ? 3 : i < high ? 2 : 1; });
  return items;
}

function frontPageItems() {
  const items = new Map();
  for (const a of document.querySelectorAll('a[href]')) {
    if (skipLink(a)) continue;
    const url = isArticleLink(a); if (!url || isAd(a) || AD_SECTION.test(sectionOf(url))) continue;
    const key = url.replace(/[?#].*$/, ''), el = headlineEl(a), teaser = el ? textOf(el) : '';
    const it = items.get(key);
    const m = el ? prominence(a, el) : { fs: 0, area: 0, y: Infinity };
    if (it) { it.teaser ||= teaser; it.paid ||= isPaid(a); it.img ||= teaserImage(a); if (m.fs * Math.sqrt(m.area) > it.m.fs * Math.sqrt(it.m.area)) it.m = { ...m, y: Math.min(m.y, it.m.y) }; }
    else items.set(key, { url, key, teaser, paid: isPaid(a), section: sectionOf(url), img: teaserImage(a), m });
  }
  return [...items.values()].filter(it => it.teaser.length >= CFG.minTeaserLen && !isGame(it.url, it.teaser) && !mutedTopicOf(it.url, it.teaser));
}

async function feedItems() {
  const link = document.querySelector('link[rel="alternate"][type*="rss"], link[rel="alternate"][type*="atom"]');
  if (!link || !CFG.fetch) return [];
  try {
    const r = await gm.xhr({ url: new URL(link.getAttribute('href'), location.href).href, headers: { Accept: 'application/rss+xml, application/atom+xml, text/xml;q=0.9, */*;q=0.5' } });
    const doc = new DOMParser().parseFromString(r.responseText, 'text/xml');
    const text = html => norm(new DOMParser().parseFromString(html || '', 'text/html').body.textContent);
    return [...doc.querySelectorAll('item, entry')].slice(0, 25).map(it => {
      const get = tag => it.getElementsByTagName(tag)[0];
      const url = get('link')?.getAttribute('href') || norm(get('link')?.textContent);
      const feedImg = get('enclosure')?.getAttribute('url') || it.getElementsByTagNameNS('*', 'thumbnail')[0]?.getAttribute('url') || it.getElementsByTagNameNS('*', 'content')[0]?.getAttribute('url') || norm(get('image')?.textContent);
      return { url, key: (url || '').replace(/[?#].*$/, ''), teaser: text(get('title')?.textContent), desc: text((get('description') || get('summary'))?.textContent), img: /^https?:/.test(feedImg || '') ? feedImg : '', section: 'latest' };
    }).filter(it => { try { return it.teaser && registrable(new URL(it.url).hostname) === registrable(host) && !isGame(it.url, it.teaser) && !mutedTopicOf(it.url, it.teaser); } catch { return false; } });
  } catch { return []; }
}

const PLAIN_CSS = `
  :host{all:initial;position:fixed;inset:0;z-index:2147483645;overflow:auto;-webkit-text-size-adjust:100%;
    --bg:#fbfbf9;--fg:#1d1d1b;--muted:#5f635f;--line:#e2e2dd;--accent:#1f7a4a;background:var(--bg);color:var(--fg);font:17px/1.5 -apple-system,system-ui,sans-serif}
  @media (prefers-color-scheme: dark){:host{--bg:#1a1b1a;--fg:#e8e8e5;--muted:#a3a7a3;--line:#333532;--accent:#5cc28a}}
  *{box-sizing:border-box;animation:none!important;transition:none!important}
  .wrap{max-width:42rem;margin:0 auto;padding:0 16px calc(48px + env(safe-area-inset-bottom, 0px))}
  header{position:sticky;top:0;z-index:1;background:var(--bg);border-bottom:1px solid var(--line);padding:calc(12px + env(safe-area-inset-top, 0px)) 0 8px}
  .top{display:flex;align-items:center;gap:8px}
  h1{font-size:20px;margin:0 auto 0 0;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  button{font:inherit;font-size:14px;color:var(--fg);background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 10px;cursor:pointer}
  button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  nav{display:flex;gap:6px;overflow-x:auto;padding-top:8px;scrollbar-width:none}
  nav::-webkit-scrollbar{display:none}
  nav button{white-space:nowrap;border-radius:999px}
  section{padding-top:20px;scroll-margin-top:110px}
  h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 2px}
  ol{list-style:none;margin:0;padding:0}
  li{padding:12px 0 12px 12px;border-bottom:1px solid var(--line)}
  li[data-tier="3"]{box-shadow:inset 3px 0 0 var(--accent)}
  li[data-tier="2"]{box-shadow:inset 3px 0 0 var(--muted)}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .sec-label{display:inline-block;margin-left:6px;font-size:12px;color:var(--muted);vertical-align:2px}
  li a{color:var(--fg);text-decoration:none;font-weight:600;font-size:18px;line-height:1.3}
  li a:visited{color:var(--muted)}
  li a:hover{text-decoration:underline}
  li p{margin:4px 0 0;color:var(--muted);font-size:16px}
  li.pic{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:12px;align-items:start}
  li.pic .pic-img{width:120px;height:80px;border-radius:6px;object-fit:cover;background:var(--line);display:block}
  @media (max-width: 480px){li.pic{grid-template-columns:minmax(0,1fr) 96px} li.pic .pic-img{width:96px;height:64px}}
  .paid{display:inline-block;margin-left:6px;padding:0 5px;border:1px solid var(--line);border-radius:4px;font-size:12px;color:var(--muted);vertical-align:2px}
  footer{color:var(--muted);font-size:13px;padding-top:24px}
  .editor{position:fixed;inset:0;z-index:2;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center}
  .editor[hidden]{display:none}
  .sheet{background:var(--bg);width:100%;max-width:28rem;max-height:80vh;overflow:auto;border-radius:12px 12px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom, 0px))}
  .sheet h2{font-size:15px;text-transform:none;letter-spacing:0;color:var(--fg);margin-bottom:8px}
  .sheet ul{list-style:none;margin:0 0 12px;padding:0}
  .sheet li{display:flex;align-items:center;gap:6px;padding:6px 0}
  .sheet label{flex:1;display:flex;gap:8px;align-items:center;cursor:pointer}
  .sheet input{accent-color:var(--accent);width:18px;height:18px}
  .sheet li button{padding:2px 9px}
  .sheet > button{width:100%;padding:8px;background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}`;


let plainHost = null, plainCount = 0;
async function plainView(withImages) {
  let items = frontPageItems();
  for (let i = 0; i < 3 && items.length < 8; i++) { await new Promise(r => setTimeout(r, 1200)); items = frontPageItems(); }
  if (items.length < 8) return false; // nothing to lay out: the caller falls back to the synopsis level
  rankItems(items);
  let sortMode = (await gm.get('plainSort', 'site')) === 'importance' ? 'importance' : 'site';
  const layout = ((await gm.get('plainLayout', {})) || {})[host] || { hidden: [], order: [] };
  readSectionNames();

  // Swallow the site: hide its body and keep its media silent.
  const st = document.createElement('style');
  st.textContent = 'html.cb-plain{overflow:hidden!important} html.cb-plain>body{display:none!important}';
  document.head.appendChild(st);
  document.documentElement.classList.add('cb-plain');
  for (const m of document.querySelectorAll('video, audio')) try { m.pause(); m.muted = true; } catch {}
  document.addEventListener('play', e => { try { e.target.pause(); e.target.muted = true; } catch {} }, true);

  plainHost = document.createElement('div');
  plainHost.id = 'declickbait-plain';
  const sh = plainHost.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>${PLAIN_CSS}</style>
    <div class="wrap"><header><div class="top"><h1></h1><button data-act="sort"></button><button data-act="sections">${T.sections}</button><button data-act="original">${T.original}</button></div><nav></nav></header>
    <main></main><footer></footer></div>
    <div class="editor" hidden><div class="sheet" role="dialog" aria-label="${T.sections}"><h2>${T.sections}</h2><ul></ul><button data-act="done">${T.done}</button></div></div>`;
  sh.querySelector('h1').textContent = pageMeta.site || host;
  document.documentElement.appendChild(plainHost);

  const sections = new Map(), byKey = new Map();
  const add = it => { if (!byKey.has(it.key)) byKey.set(it.key, it); if (!sections.has(it.section)) sections.set(it.section, []); sections.get(it.section).push(it); };
  items.forEach(add);
  // Sections in the order the user chose, then the rest in order of first appearance on the page.
  const order = () => [...layout.order.filter(id => sections.has(id)), ...[...sections.keys()].filter(id => !layout.order.includes(id))];

  const main = sh.querySelector('main'), nav = sh.querySelector('nav'), rows = new Map(), want = [];
  function fill(it, li) {
    const m = cache[it.key];
    if (m && !m.err && mutedTopicOf(it.url, it.teaser, m)) { dropRow(it.key, li); return; }
    const meta = m && !m.err ? cleanMeta(m, it.url) : it.desc ? { title: '', desc: it.desc } : null;
    const { text, lead } = choose(it.teaser, meta);
    const a = li.querySelector('a'), p = li.querySelector('p');
    a.textContent = text;
    if (norm(text) !== norm(it.teaser)) a.title = 'Original: ' + it.teaser;
    p.textContent = lead; p.hidden = !lead;
    const im = li.querySelector('.pic-img');
    const src = im && (it.img || (m && !m.err && m.image) || '');
    if (src && im.getAttribute('src') !== src) im.src = src;
  }
  // An article whose metadata reveals a muted topic leaves the page, and its section too once empty.
  function dropRow(key, li) {
    const sec = li.closest('section');
    li.remove(); rows.delete(key); plainCount = rows.size;
    if (sec && !sec.querySelector('li')) { nav.querySelector(`[data-sec="${sec.id}"]`)?.remove(); sec.remove(); }
    sh.querySelector('footer').textContent = `${T.count(rows.size)} · ${host} · ${(typeof GM !== 'undefined' && GM.info?.script?.name) || 'Declickbait'}`;
  }
  const seenRows = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { const i = want.indexOf(e.target.dataset.key); if (i > 0) want.unshift(...want.splice(i, 1)); }
    pumpPlain();
  }, { rootMargin: '400px' });
  let running = 0;
  function pumpPlain() {
    while (running < CFG.concurrency && want.length) {
      const key = want.shift(), it = byKey.get(key);
      running++;
      getMeta(it.url).finally(() => { running--; const li = rows.get(key); if (li) fill(it, li); pumpPlain(); });
    }
  }
  function row(it, withSection) {
    const li = document.createElement('li'), a = document.createElement('a'), p = document.createElement('p');
    a.href = it.url; li.dataset.key = it.key;
    if (it.tier > 1) {
      // The front page's own sense of importance, as a quiet bar instead of big type.
      li.dataset.tier = it.tier;
      const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = (it.tier === 3 ? T.top : T.important) + ': ';
      li.append(sr);
    }
    const text = withImages ? document.createElement('div') : li;
    text.append(a);
    if (it.paid) { const b = document.createElement('span'); b.className = 'paid'; b.textContent = T.paid; text.append(b); }
    if (withSection) { const sl = document.createElement('span'); sl.className = 'sec-label'; sl.textContent = sectionLabel(it.section); text.append(sl); }
    text.append(p);
    if (withImages) {
      // Every row gets the same frame, with or without a picture, so the list stays even.
      const im = document.createElement('img');
      im.className = 'pic-img'; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      im.addEventListener('error', () => im.removeAttribute('src'));
      li.className = 'pic'; li.append(text, im);
    }
    rows.set(it.key, li);
    fill(it, li);
    if (!cache[it.key]) { want.push(it.key); seenRows.observe(li); }
    return li;
  }
  function render() {
    const y = plainHost.scrollTop;
    main.replaceChildren(); nav.replaceChildren(); rows.clear(); want.length = 0; seenRows.disconnect();
    sh.querySelector('[data-act="sort"]').textContent = sortMode === 'importance' ? T.siteOrder : T.byImportance;
    if (sortMode === 'importance') {
      // One list across the visible sections, loudest on the front page first; feed-only items last.
      const ol = document.createElement('ol'), seenKeys = new Set();
      const all = order().filter(id => !layout.hidden.includes(id)).flatMap(id => sections.get(id))
        .filter(it => !seenKeys.has(it.key) && seenKeys.add(it.key)).sort((a, b) => (b.score || 0) - (a.score || 0));
      for (const it of all) if (!rows.has(it.key)) ol.append(row(it, true));
      const sec = document.createElement('section'), h2 = document.createElement('h2');
      sec.id = 's-importance'; h2.textContent = T.byImportance;
      sec.append(h2, ol); main.append(sec);
    }
    else for (const id of order()) {
      if (layout.hidden.includes(id)) continue;
      const ol = document.createElement('ol');
      for (const it of sections.get(id)) {
        if (rows.has(it.key)) continue; // an article in two sections is shown once
        ol.append(row(it, false));
      }
      if (!ol.childElementCount) continue;
      const sec = document.createElement('section'), h2 = document.createElement('h2'), chip = document.createElement('button');
      sec.id = 's-' + id; chip.dataset.sec = sec.id; h2.textContent = chip.textContent = sectionLabel(id);
      chip.addEventListener('click', () => sec.scrollIntoView());
      sec.append(h2, ol); main.append(sec); nav.append(chip);
    }
    plainCount = rows.size;
    sh.querySelector('footer').textContent = `${T.count(rows.size)} · ${host} · ${(typeof GM !== 'undefined' && GM.info?.script?.name) || 'Declickbait'}`;
    plainHost.scrollTop = y;
    pumpPlain();
  }

  // Section editor: show/hide and reorder, remembered per host.
  const editor = sh.querySelector('.editor'), list = editor.querySelector('ul');
  function openEditor() {
    list.replaceChildren();
    for (const id of order()) {
      const li = document.createElement('li');
      li.dataset.id = id;
      li.innerHTML = `<label><input type="checkbox"><span></span></label><button data-move="-1" aria-label="${T.up}">↑</button><button data-move="1" aria-label="${T.down}">↓</button>`;
      li.querySelector('span').textContent = `${sectionLabel(id)} (${sections.get(id).length})`;
      li.querySelector('input').checked = !layout.hidden.includes(id);
      list.append(li);
    }
    editor.hidden = false;
  }
  async function saveEditor() {
    layout.order = [...list.children].map(li => li.dataset.id);
    layout.hidden = [...list.children].filter(li => !li.querySelector('input').checked).map(li => li.dataset.id);
    await gm.set('plainLayout', { ...((await gm.get('plainLayout', {})) || {}), [host]: layout });
    editor.hidden = true;
    render();
  }
  sh.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'sections') openEditor();
    else if (b.dataset.act === 'sort') { sortMode = sortMode === 'importance' ? 'site' : 'importance'; gm.set('plainSort', sortMode); plainHost.scrollTop = 0; render(); }
    else if (b.dataset.act === 'done') saveEditor();
    else if (b.dataset.act === 'original') { try { sessionStorage.setItem('declickbait-original', host); } catch {} location.reload(); }
    else if (b.dataset.move) {
      const li = b.closest('li');
      if (b.dataset.move < 0 && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
      else if (b.dataset.move > 0 && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
    }
  });
  editor.addEventListener('click', e => { if (e.target === editor) saveEditor(); });

  render();
  feedItems().then(feed => { if (!feed.length) return; feed.forEach(add); render(); });
  return true;
}
