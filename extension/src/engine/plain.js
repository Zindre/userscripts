// ───────────────────────────── Plain view ─────────────────────────────
// Level "plain" swaps a front page for a calm page of our own: the site's articles grouped by
// section, headline and lead only, in the editors' order. The site's <body> is hidden and its
// media paused, so ads, autoplay video, pop-ups and animation never show. A "Latest" section
// comes from the site's RSS/Atom feed. Article pages are left alone (they get the synopsis
// level). Paywalls stay: paid articles are marked and open on the site as usual.
const NB = /^(nb|nn|no)\b/i.test(document.documentElement.lang || '');
const T = NB
  ? { siteOrder: 'Avisens rekkefølge', byImportance: 'Viktigst først', top: 'Toppsak', important: 'Viktig', related: 'Relaterte saker', latest: 'Siste', other: 'Annet', sections: 'Seksjoner', original: 'Original', done: 'Ferdig', paid: 'Abonnement', count: n => `${n} saker`, up: 'Flytt opp', down: 'Flytt ned', loading: 'Henter saken …', onSite: h => `Les på ${h}`, close: 'Lukk', paidHere: 'Saken krever abonnement.', subscribe: h => `Jeg abonnerer på ${h}`, unsubscribe: h => `Jeg abonnerer ikke på ${h}`, prev: 'Forrige sak', next: 'Neste sak', unreadable: 'Denne saken kan ikke vises her, men du kan lese den på nettstedet.', keys: '↑ ↓ velg sak · Enter åpne · ← → forrige og neste · Esc lukk' }
  : { siteOrder: 'Site order', byImportance: 'Most important first', top: 'Top story', important: 'Important', related: 'Related articles', latest: 'Latest', other: 'Other', sections: 'Sections', original: 'Original', done: 'Done', paid: 'Subscription', count: n => `${n} articles`, up: 'Move up', down: 'Move down', loading: 'Loading the article …', onSite: h => `Read on ${h}`, close: 'Close', paidHere: 'This article is for subscribers.', subscribe: h => `I subscribe to ${h}`, unsubscribe: h => `I don't subscribe to ${h}`, prev: 'Previous article', next: 'Next article', unreadable: "This article can't be shown here, but you can read it on the site.", keys: '↑ ↓ choose · Enter open · ← → previous and next · Esc close' };
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

// known: articles already collected, skipped without measuring (harvest() calls this repeatedly).
function frontPageItems(known) {
  const items = new Map();
  for (const a of document.querySelectorAll('a[href]')) {
    if (skipLink(a)) continue;
    const url = isArticleLink(a); if (!url) continue;
    const key = url.replace(/[?#].*$/, '');
    if (known?.has(key) || isAd(a) || AD_SECTION.test(sectionOf(url))) continue;
    const el = headlineEl(a), teaser = el ? textOf(el) : '';
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

// Front pages that fill in as they are scrolled (VG) are read by scrolling the hidden page, so the
// site's own lazy loading adds the rest. Stops after six screens without new articles, at the end of
// the page, when done() says so, or after 40 screens.
async function harvest(known, onNew, done = () => false) {
  for (let i = 0, idle = 0; i < 40 && idle < 6 && !done(); i++) {
    window.scrollBy(0, innerHeight * 1.5);
    await new Promise(r => setTimeout(r, 250));
    const fresh = frontPageItems(known);
    fresh.forEach(it => known.set(it.key, it));
    if (fresh.length) { idle = 0; onNew(fresh); }
    else if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) idle += 3;
    else idle++;
  }
}

// The site's own logo for plain view's header: the first picture in a link to the front page near
// the top. An SVG is copied with the colours it is drawn in (its stylesheet stays behind), without
// scripts or event handlers; it sits on the colour it had on the site, so it reads in dark mode too.
// null: plain view shows the site's name instead.
function siteLogo() {
  const bgOf = el => { for (; el; el = el.parentElement) { const b = getComputedStyle(el).backgroundColor; if (b && !/^(?:transparent|rgba\(0, 0, 0, 0\))$/.test(b)) return b; } return '#fff'; };
  for (const a of document.querySelectorAll('a[href]')) {
    let u; try { u = new URL(a.href); } catch { continue; }
    if (u.pathname !== '/' || registrable(u.hostname) !== registrable(host)) continue;
    const g = a.querySelector('svg, img'); if (!g || g.closest('[class*="cmp" i], [id*="cmp" i], [class*="consent" i], dialog')) continue;
    const r = g.getBoundingClientRect();
    if (r.top + scrollY > 400 || r.width < 30 || r.height < 12 || r.height > 200) continue;
    if (g.tagName === 'IMG') {
      const src = g.currentSrc || g.src; if (!/^https?:/.test(src)) continue;
      const im = document.createElement('img'); im.src = src; im.alt = '';
      return { el: im, bg: bgOf(a) };
    }
    if (g.querySelector('use')) continue; // sprite references don't survive the move
    const c = g.cloneNode(true), from = [g, ...g.querySelectorAll('*')], to = [c, ...c.querySelectorAll('*')];
    from.forEach((x, i) => {
      const cs = getComputedStyle(x), d = to[i];
      for (const prop of ['fill', 'fill-rule', 'stroke', 'stroke-width', 'color', 'opacity', 'display']) d.style.setProperty(prop, cs.getPropertyValue(prop));
      for (const at of [...d.attributes]) if (/^on/i.test(at.name)) d.removeAttribute(at.name);
    });
    c.querySelectorAll('script, foreignObject').forEach(x => x.remove());
    c.removeAttribute('class'); c.setAttribute('aria-hidden', 'true');
    if (!c.getAttribute('viewBox')) c.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    c.setAttribute('width', r.width); c.setAttribute('height', r.height);
    return { el: c, bg: bgOf(a) };
  }
  return null;
}

const PLAIN_CSS = `
  :host{all:initial;position:fixed;inset:0;z-index:2147483645;overflow:auto;-webkit-text-size-adjust:100%;
    --bg:#fbfbf9;--paper:#fff;--fg:#1d1d1b;--muted:#5f635f;--line:#e2e2dd;--accent:#2f5f8f;background:var(--bg);color:var(--fg);font:17px/1.5 -apple-system,system-ui,sans-serif}
  @media (prefers-color-scheme: dark){:host{--bg:#1a1b1a;--paper:#222422;--fg:#e8e8e5;--muted:#a3a7a3;--line:#333532;--accent:#7fa8d6}}
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
  a.h{color:var(--fg);text-decoration:none;font-weight:600;font-size:18px;line-height:1.3}
  a.h:visited,li.read a.h{color:var(--muted)}
  a.h:hover{text-decoration:underline}
  p.lead{margin:4px 0 0;color:var(--muted);font-size:16px}
  .logo{display:inline-flex;align-items:center;padding:4px 8px;border-radius:6px;margin-left:-8px}
  .logo svg,.logo img{display:block;height:26px;width:auto;max-width:200px}
  .keys{display:none;color:var(--muted);font-size:13px;padding-top:6px}
  @media (hover: hover) and (pointer: fine){.keys{display:block}}
  main a.h:focus-visible{outline:none}
  main li[data-key]:focus-within{background:var(--paper);box-shadow:inset 0 0 0 2px var(--accent)}
  /* The whole card opens the article. */
  main li[data-key]{cursor:pointer;scroll-margin-top:110px}
  main li[data-key]:hover{background:var(--paper)}
  /* An article opens over the list, full screen; closing it leaves the list where it was. */
  .view{position:fixed;inset:0;z-index:3;overflow:auto;overscroll-behavior:contain;background:var(--bg)}
  .view[hidden]{display:none}
  .view:focus{outline:none}
  .view .bar{position:sticky;top:0;z-index:1;background:var(--bg);border-bottom:1px solid var(--line);padding:calc(10px + env(safe-area-inset-top, 0px)) 16px 10px}
  .view .bar div{max-width:42rem;margin:0 auto;display:flex;align-items:center;gap:10px}
  .view .bar span{flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .view .bar button{flex:none;font-size:15px;padding:6px 12px}
  .view .bar button[data-act="prev"],.view .bar button[data-act="next"]{padding:6px 10px}
  .view .bar button:disabled{opacity:.35;cursor:default}
  .reader{max-width:42rem;margin:0 auto;padding:20px 16px calc(48px + env(safe-area-inset-bottom, 0px));font-size:18px;line-height:1.6}
  .reader h1{font-size:26px;line-height:1.25;margin:0 0 10px;white-space:normal}
  .reader .lede{font-size:19px;color:var(--muted);margin:0 0 14px}
  .reader .note{color:var(--muted)}
  .reader p{margin:0 0 .9em}
  .reader h3{font-size:19px;margin:1.2em 0 .4em}
  .reader blockquote{margin:0 0 .9em;padding-left:12px;border-left:3px solid var(--line);color:var(--muted)}
  .reader ul,.reader ol{margin:0 0 .9em;padding-left:1.3em}
  .reader li{padding:0 0 .3em;border:0;box-shadow:none}
  .reader figure{margin:0 0 1em}
  .reader img{display:block;max-width:100%;height:auto;border-radius:6px;background:var(--line)}
  .reader figcaption{font-size:14px;color:var(--muted);margin-top:4px}
  .reader .byline{font-size:14px;color:var(--muted);margin-bottom:14px}
  .reader .end{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding-top:8px;border-top:1px solid var(--line)}
  .reader .end a{color:var(--accent);font-weight:600;text-decoration:none}
  .reader .end a:hover{text-decoration:underline}
  /* Wide screens: the articles in columns. */
  @media (min-width: 1000px){
    .wrap{max-width:88rem}
    section > ol{display:grid;grid-template-columns:repeat(auto-fill,minmax(22rem,1fr));column-gap:32px}
  }
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
  let logo = null; try { logo = siteLogo(); } catch {} // before harvest() scrolls the page
  let items = frontPageItems();
  for (let i = 0; i < 2 && items.length < 8; i++) { await new Promise(r => setTimeout(r, 1200)); items = frontPageItems(); }
  // Swallow the site: hide its body and keep its media silent. The body keeps its layout while
  // harvest() scrolls it (lazy loading needs that), and is taken out of the page once it is done.
  const st = document.createElement('style');
  st.textContent = 'html.cb-plain{overflow:hidden!important} html.cb-plain>body,html.cb-plain>body *{visibility:hidden!important;pointer-events:none!important} html.cb-plain.cb-plain-done>body{display:none!important}';
  document.head.appendChild(st);
  document.documentElement.classList.add('cb-plain');
  for (const m of document.querySelectorAll('video, audio')) try { m.pause(); m.muted = true; } catch {}
  document.addEventListener('play', e => { try { e.target.pause(); e.target.muted = true; } catch {} }, true);
  const known = new Map(items.map(it => [it.key, it]));
  if (items.length < 8) await harvest(known, fresh => items.push(...fresh), () => items.length >= 8);
  if (items.length < 8) {
    // Nothing to lay out: give the page back, and the caller falls back to the synopsis level.
    document.documentElement.classList.remove('cb-plain'); st.remove(); window.scrollTo(0, 0);
    return false;
  }
  rankItems(items);
  let sortMode = (await gm.get('plainSort', 'site')) === 'importance' ? 'importance' : 'site';
  const layout = ((await gm.get('plainLayout', {})) || {})[host] || { hidden: [], order: [] };
  let subscribedHosts = (await gm.get('subscribedHosts', [])) || [];
  readSectionNames();

  plainHost = document.createElement('div');
  plainHost.id = 'declickbait-plain';
  const sh = plainHost.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>${PLAIN_CSS}</style>
    <div class="wrap"><header><div class="top"><h1></h1><button data-act="sort"></button><button data-act="sections">${T.sections}</button><button data-act="original">${T.original}</button></div><nav></nav></header>
    <main></main><footer></footer><div class="keys"></div></div>
    <div class="view" hidden role="dialog" aria-modal="true" tabindex="-1"><div class="bar"><div><span></span><button data-act="prev">‹</button><button data-act="next">›</button><button data-act="close-reader"></button></div></div><article class="reader"></article></div>
    <div class="editor" hidden><div class="sheet" role="dialog" aria-label="${T.sections}"><h2>${T.sections}</h2><ul></ul><button data-act="done">${T.done}</button></div></div>`;
  const h1 = sh.querySelector('h1');
  if (logo) {
    const chip = document.createElement('span'), name = document.createElement('span');
    chip.className = 'logo'; chip.style.background = logo.bg; chip.append(logo.el);
    name.className = 'sr'; name.textContent = pageMeta.site || host;
    h1.append(chip, name);
  } else h1.textContent = pageMeta.site || host;
  sh.querySelector('.keys').textContent = T.keys;
  document.documentElement.appendChild(plainHost);
  document.getElementById('nothis-cover')?.remove();
  // Remember the site, so next time the extension covers it before the original is drawn.
  gm.get('plainHosts', []).then(hs => gm.set('plainHosts', [host, ...(hs || []).filter(h => h !== host)].slice(0, 300)));

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
    const a = li.querySelector('a.h'), p = li.querySelector('p.lead');
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
    for (const e of es) if (e.isIntersecting) { const i = want.indexOf(e.target.dataset.key); if (i > 0) want.unshift(...want.splice(i, 1)); prefetch(e.target.dataset.key); }
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
    a.href = it.url; a.className = 'h'; a.dataset.key = it.key; p.className = 'lead'; li.dataset.key = it.key;
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
    if (!rows.has(it.key)) return null; // cached metadata showed a muted topic: fill() dropped it
    if (!cache[it.key]) want.push(it.key);
    seenRows.observe(li);
    if (readKeys.has(it.key)) li.classList.add('read');
    return li;
  }

  // Reading in place: a card opens its article full screen over the list, which stays where it was.
  // Close, Escape and the browser's back (swipe back on a phone) return to the list.
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  const view = sh.querySelector('.view'), reader = view.querySelector('.reader'), readKeys = new Set();
  view.querySelector('[data-act="close-reader"]').textContent = '✕ ' + T.close;
  let current = null; // the article on screen
  // replace: moving to the previous/next article, which shouldn't stack up in the history.
  function openArticle(it, replace) {
    const li = rows.get(it.key);
    current = it; readKeys.add(it.key); li?.classList.add('read');
    view.querySelector('.bar span').textContent = li?.querySelector('a.h').textContent || it.teaser;
    const list = cards(), i = list.indexOf(li);
    view.querySelector('[data-act="prev"]').disabled = i <= 0;
    view.querySelector('[data-act="next"]').disabled = i < 0 || i >= list.length - 1;
    reader.replaceChildren(el('p', T.loading, 'note'));
    view.hidden = false; view.scrollTop = 0; view.focus({ preventScroll: true });
    try { if (!replace || !history.state?.nothis) history.pushState({ nothis: it.key }, ''); } catch {}
    fillReader(it);
    // The neighbours are likely next: fetch them now.
    for (const n of [list[i + 1], list[i - 1]]) if (n) prefetch(n.dataset.key, true);
  }
  // Previous/next article while reading; the list behind follows, so closing lands on it.
  function step(d) {
    const list = cards(), li = current && rows.get(current.key), next = list[list.indexOf(li) + d];
    if (!next) return;
    focusCard(next);
    openArticle(byKey.get(next.dataset.key), true);
  }
  const cards = () => [...main.querySelectorAll('li[data-key]')];
  function focusCard(li) { li.querySelector('a.h')?.focus({ preventScroll: true }); li.scrollIntoView({ block: 'nearest' }); }

  // Articles are fetched ahead so they open at once: the ones on screen (a few at a time, up to 40
  // per visit), and right away the one under the pointer or keyboard focus and the neighbours of the
  // one being read. Pages fetched for the headlines are reused (articleFetched in reader.js).
  readerFor = () => ({ withImages, subscribed: subscribedHosts.includes(host) });
  const ahead = [];
  let aheadRunning = 0, aheadLeft = 40;
  function prefetch(key, now) {
    const it = byKey.get(key); if (!it) return;
    const { subscribed } = readerFor();
    if (readerCache.has(readerKey(it.url, subscribed))) return;
    if (now) { fetchArticle(it.url, withImages, subscribed); return; }
    if (aheadLeft > 0 && !ahead.includes(key)) { ahead.push(key); aheadLeft--; pumpAhead(); }
  }
  function pumpAhead() {
    while (aheadRunning < 2 && ahead.length) {
      const it = byKey.get(ahead.shift()); if (!it) continue;
      aheadRunning++;
      fetchArticle(it.url, withImages, readerFor().subscribed).finally(() => { aheadRunning--; pumpAhead(); });
    }
  }
  for (const ev of ['pointerenter', 'focusin', 'touchstart']) main.addEventListener(ev, e => {
    const li = e.target.closest?.('li[data-key]'); if (li) prefetch(li.dataset.key, true);
  }, { capture: true, passive: true });
  function closeArticle(fromHistory) {
    if (!current) return;
    const key = current.key;
    current = null; view.hidden = true; reader.replaceChildren();
    if (!fromHistory && history.state?.nothis) history.back();
    rows.get(key)?.querySelector('a.h')?.focus({ preventScroll: true });
  }
  window.addEventListener('popstate', () => closeArticle(true));
  async function fillReader(it) {
    const subscribed = subscribedHosts.includes(host);
    const art = await fetchArticle(it.url, withImages, subscribed);
    if (current !== it) return; // closed, or another one opened meanwhile
    const li = rows.get(it.key), lede = li?.querySelector('p.lead')?.textContent;
    const out = [el('h1', li?.querySelector('a.h').textContent || it.teaser)];
    if (lede) out.push(el('p', lede, 'lede'));
    const by = art && [art.byline, art.date && new Date(art.date).toLocaleString(NB ? 'nb-NO' : undefined, { dateStyle: 'medium', timeStyle: 'short' })].filter(x => x && x !== 'Invalid Date').join(' · ');
    if (by) out.push(el('div', by, 'byline'));
    for (const b of art?.blocks || []) {
      if (b.t === 'p') out.push(el('p', b.text));
      else if (b.t === 'h') out.push(el('h3', b.text));
      else if (b.t === 'quote') out.push(el('blockquote', b.text));
      else if (b.t === 'list') { const l = el(b.ordered ? 'ol' : 'ul'); for (const t of b.items) l.append(el('li', t)); out.push(l); }
      else if (b.t === 'img') {
        const f = el('figure'), im = el('img');
        im.src = b.src; im.alt = b.caption || ''; im.loading = 'lazy'; im.decoding = 'async';
        im.addEventListener('error', () => f.remove());
        f.append(im); if (b.caption) f.append(el('figcaption', b.caption)); out.push(f);
      }
    }
    if (!art) out.push(el('p', T.unreadable, 'note')); // a video, live page or app: the site shows it
    else if (art.paid && !subscribed) out.push(el('p', T.paidHere, 'note'));
    const end = el('div', '', 'end'), site = el('a', T.onSite(host)), close = el('button', T.close);
    site.href = it.url; close.dataset.act = 'close-reader';
    end.append(site);
    if (art?.paid) {
      // Whether you subscribe is yours to say; the site still decides what it sends you.
      const sub = el('button', subscribed ? T.unsubscribe(host) : T.subscribe(host));
      sub.addEventListener('click', async () => {
        subscribedHosts = subscribed ? subscribedHosts.filter(h => h !== host) : [...subscribedHosts, host];
        await gm.set('subscribedHosts', subscribedHosts);
        reader.replaceChildren(el('p', T.loading, 'note')); fillReader(it);
      });
      end.append(sub);
    }
    end.append(close); out.push(end);
    reader.replaceChildren(...out);
  }
  function render() {
    // Keep the article at the top of the screen in place when the list changes around it.
    const y = plainHost.scrollTop, top = sh.querySelector('header').getBoundingClientRect().bottom;
    const anchor = [...main.querySelectorAll('li[data-key]')].find(li => li.getBoundingClientRect().bottom > top);
    const anchorKey = anchor?.dataset.key, anchorTop = anchor?.getBoundingClientRect().top;
    main.replaceChildren(); nav.replaceChildren(); rows.clear(); want.length = 0; seenRows.disconnect();
    sh.querySelector('[data-act="sort"]').textContent = sortMode === 'importance' ? T.siteOrder : T.byImportance;
    if (sortMode === 'importance') {
      // One list across the visible sections, loudest on the front page first; feed-only items last.
      const ol = document.createElement('ol'), seenKeys = new Set();
      const all = order().filter(id => !layout.hidden.includes(id)).flatMap(id => sections.get(id))
        .filter(it => !seenKeys.has(it.key) && seenKeys.add(it.key)).sort((a, b) => (b.score || 0) - (a.score || 0));
      for (const it of all) if (!rows.has(it.key)) { const li = row(it, true); if (li) ol.append(li); }
      const sec = document.createElement('section'), h2 = document.createElement('h2');
      sec.id = 's-importance'; h2.textContent = T.byImportance;
      sec.append(h2, ol); main.append(sec);
    }
    else for (const id of order()) {
      if (layout.hidden.includes(id)) continue;
      const ol = document.createElement('ol');
      for (const it of sections.get(id)) {
        if (rows.has(it.key)) continue; // an article in two sections is shown once
        const li = row(it, false); if (li) ol.append(li);
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
    const again = y > 0 && anchorKey && rows.get(anchorKey); // at the top, the top it stays
    if (again) plainHost.scrollTop += again.getBoundingClientRect().top - anchorTop;
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
    // The whole card opens the article; Cmd/Ctrl/Shift-click on the headline still opens the site.
    const card = e.target.closest('main li[data-key]');
    if (card && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      const it = byKey.get(card.dataset.key);
      if (it) { e.preventDefault(); openArticle(it); }
      return;
    }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'close-reader') closeArticle();
    else if (b.dataset.act === 'prev') step(-1);
    else if (b.dataset.act === 'next') step(1);
    else if (b.dataset.act === 'sections') openEditor();
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
  // Keyboard: ↓/j and ↑/k choose an article, Enter (on the focused headline) or o opens it;
  // while reading, →/j and ←/k go to the next and previous article and Esc closes.
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !editor.hidden) return;
    const t = e.composedPath()[0];
    if (t && (/^(?:INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    const k = e.key;
    if (current) {
      if (k === 'Escape') closeArticle();
      else if (k === 'ArrowRight' || k === 'j') step(1);
      else if (k === 'ArrowLeft' || k === 'k') step(-1);
      else return;
    } else if (k === 'ArrowDown' || k === 'j' || k === 'ArrowUp' || k === 'k') {
      const list = cards(), d = k === 'ArrowDown' || k === 'j' ? 1 : -1;
      let i = list.findIndex(li => li.contains(sh.activeElement));
      if (i < 0) { const top = sh.querySelector('header').getBoundingClientRect().bottom; i = list.findIndex(li => li.getBoundingClientRect().top >= top) - (d > 0 ? 1 : 0); }
      const next = list[Math.max(0, Math.min(list.length - 1, i + d))];
      if (!next) return;
      focusCard(next); prefetch(next.dataset.key, true);
    } else if (k === 'o') {
      const li = cards().find(li => li.contains(sh.activeElement)); if (!li) return;
      openArticle(byKey.get(li.dataset.key));
    } else return;
    e.preventDefault();
  });

  render();
  feedItems().then(feed => { if (!feed.length) return; feed.forEach(add); render(); });
  // Read the rest of a lazily filled front page, a few articles at a time, then drop the site's body.
  let later = null;
  harvest(known, fresh => {
    items.push(...fresh); rankItems(items); fresh.forEach(add);
    clearTimeout(later); later = setTimeout(render, 600);
  }).then(() => { window.scrollTo(0, 0); document.documentElement.classList.add('cb-plain-done'); });
  return true;
}
