// ───────────────────────────── Plain view ─────────────────────────────
// Level "plain" swaps a front page for a calm page of our own: the site's articles grouped by
// section, headline and lead only, in the editors' order. The site's <body> is hidden and its
// media paused, so ads, autoplay video, pop-ups and animation never show. A "Latest" section
// comes from the site's RSS/Atom feed. Article pages are left alone (they get the synopsis
// level). Paid articles are marked; what the site sends for them is what the reader shows.
// The list's and the reader's texts, in the site's own language (src/i18n/).
const T = stringsFor(document.documentElement.lang);
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
function readSectionNames(root = document) {
  const links = [...root.querySelectorAll('a[href]')];
  for (const a of [...links.filter(a => a.closest(SKIP_CONTAINERS)), ...links.filter(a => !a.closest(SKIP_CONTAINERS))]) {
    let u; try { u = new URL(a.href); } catch { continue; }
    const m = u.pathname.replace(/^\/(?:aktuell|aktuelles)(?=\/.)/i, '').match(/^\/([^/]+)\/?$/);
    // "voir toute l'actu Société", "See all Sport", "Alle Nyheter" → the section name only
    const t = norm(a.textContent).replace(/^(?:voir (?:toute )?l['’]actu|voir tou(?:te)?s? les|tous les|toutes les|see all|view all|more from|se alle|alle|mer fra|mehr aus|mehr)\s+/i, '').replace(/^\p{Ll}/u, c => c.toUpperCase());
    const id = m && m[1].toLowerCase(), had = id && sectionNames.get(id);
    if (m && registrable(u.hostname) === registrable(host) && t.length >= 2 && t.length <= 30 && !had) sectionNames.set(id, t);
  }
}
const sectionLabel = id => id === 'latest' ? T.latest : id === 'other' ? T.other : id === 'saved-later' ? T.later : id === 'saved-marks' ? T.marks : sectionNames.get(id) || (id[0].toUpperCase() + id.slice(1)).replace(/-/g, ' ');
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
  // At most 8 elements: on nytimes.com's thousand links, 30 each took Safari 1.5 s before the list could show.
  for (const x of [el, ...el.querySelectorAll('*')].slice(0, 8)) fs = Math.max(fs, parseFloat(getComputedStyle(x).fontSize) || 0);
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
// measure false: without prominence(), which needs the page laid out (the heavy-page path at the end of plainView); the
// headline's level stands in for its size. root: a downloaded copy of the page instead (plainView, a stopped heavy page).
const LEVEL_SIZE = { H1: 40, H2: 32, H3: 26, H4: 22 };
function frontPageItems(known, measure = true, root = document) {
  const items = new Map();
  for (const a of root.querySelectorAll('a[href]')) {
    if (skipLink(a)) continue;
    const url = isArticleLink(a); if (!url) continue;
    const key = url.replace(/[?#].*$/, '');
    if (known?.has(key) || isAd(a) || AD_SECTION.test(sectionOf(url))) continue;
    const el = headlineEl(a), teaser = el ? textOf(el) : '';
    const it = items.get(key);
    const m = el && measure ? prominence(a, el) : { fs: (el && LEVEL_SIZE[el.tagName]) || 0, area: 0, y: Infinity };
    if (it) { it.teaser ||= teaser; it.paid ||= isPaid(a); it.img ||= teaserImage(a); if (m.fs * Math.sqrt(m.area) > it.m.fs * Math.sqrt(it.m.area)) it.m = { ...m, y: Math.min(m.y, it.m.y) }; }
    else items.set(key, { url, key, teaser, paid: isPaid(a), section: sectionOf(url), img: teaserImage(a), m });
  }
  return [...items.values()].filter(it => it.teaser.length >= CFG.minTeaserLen && !isGame(it.url, it.teaser) && !mutedTopicOf(it.url, it.teaser));
}

async function feedItems(root = document) {
  const link = root.querySelector('link[rel="alternate"][type*="rss"], link[rel="alternate"][type*="atom"]');
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

// The engine starts as soon as the HTML is parsed, before the site's own scripts have run: a front page they build
// gets its links a moment later. Read again as the page changes, until there are enough or ms have passed.
async function frontPageSoon(enough, ms) {
  let items = frontPageItems();
  if (items.length >= enough) return items;
  // Still arriving (an early start, see build.mjs): each read forces a layout of the half-loaded page, so it waits for
  // the HTML to be in (or ms) and reads once.
  if (document.readyState === 'loading') {
    await new Promise(r => { document.addEventListener('readystatechange', r, { once: true }); setTimeout(r, ms); });
    items = frontPageItems();
    if (items.length >= enough || document.readyState === 'loading') return items;
  }
  await new Promise(res => {
    let t = null;
    const done = () => { clearTimeout(end); clearTimeout(t); watch.disconnect(); res(); };
    const end = setTimeout(() => { items = frontPageItems(); done(); }, ms);
    const watch = new MutationObserver(() => { t ||= setTimeout(() => { t = null; items = frontPageItems(); if (items.length >= enough) done(); }, 200); });
    watch.observe(document.documentElement, { childList: true, subtree: true });
  });
  return items;
}

// Front pages that fill in as they are scrolled (VG) are read by scrolling the hidden page, so the
// site's own lazy loading adds the rest. Stops after six screens without new articles, at the end of
// the page, when done() says so, or after 40 screens.
// hold: while true the scrolling waits (someone is using plain view; see the end of plainView).
async function harvest(known, onNew, done = () => false, hold = () => false) {
  // Each pass reads every link on the page and measures the new ones, which makes the browser lay the page out: on
  // nytimes.com in Safari a pass took over a second, and passes every quarter second kept the page frozen for 24 s, so a
  // click in the list waited. So it rests four times as long as its last pass took, keeping it to a fifth of the time.
  // While the page is still loading (plain view can start before, see build.mjs), it waits for the loading to end.
  let rest = 250, passes = 0, spent = 0;
  for (let i = 0, idle = 0; i < 40 && idle < 6 && !done(); i++) {
    while (hold()) await new Promise(r => setTimeout(r, 400));
    if (document.readyState === 'loading') {
      await new Promise(r => { document.addEventListener('readystatechange', r, { once: true }); setTimeout(r, 3000); });
      i--; continue;
    }
    window.scrollBy(0, innerHeight * 1.5);
    await new Promise(r => setTimeout(r, rest));
    const t0 = performance.now();
    const fresh = frontPageItems(known);
    const took = performance.now() - t0; passes++; spent += took;
    rest = Math.max(250, took * 4);
    fresh.forEach(it => known.set(it.key, it));
    if (fresh.length) { idle = 0; onNew(fresh); }
    else if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) idle += 3;
    else idle++;
  }
  timeMark(`harvest-${passes}-passes-${Math.round(spent)}ms`);
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
  :host{all:initial;position:fixed;inset:0;z-index:2147483645;overflow:auto;overflow-anchor:none;-webkit-text-size-adjust:100%;
    --bg:#fbfbf9;--paper:#fff;--fg:#1d1d1b;--muted:#5f635f;--line:#e2e2dd;--accent:#2f5f8f;background:var(--bg);color:var(--fg);font:17px/1.5 -apple-system,system-ui,sans-serif}
  @media (prefers-color-scheme: dark){:host{--bg:#1a1b1a;--paper:#222422;--fg:#e8e8e5;--muted:#a3a7a3;--line:#333532;--accent:#7fa8d6}}
  *{box-sizing:border-box;animation:none!important;transition:none!important}
  .wrap{max-width:42rem;margin:0 auto;padding:0 16px calc(48px + env(safe-area-inset-bottom, 0px))}
  header{position:sticky;top:0;z-index:1;background:var(--bg);border-bottom:1px solid var(--line);padding:calc(12px + env(safe-area-inset-top, 0px)) 0 8px}
  .top{display:flex;align-items:center;gap:8px}
  h1{font-size:20px;margin:0 auto 0 0;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto;min-width:56px}
  h1:has(.logo){margin-left:-8px}
  /* The buttons keep their size and one line; the site's name or logo gets what is left, and a logo shrinks to fit. */
  .top button{flex:none;white-space:nowrap}
  @media (max-width: 480px){.top{gap:6px} .top button{font-size:13px;padding:5px 8px}}
  @media (max-width: 360px){.top{gap:4px} .top button{font-size:12px;padding:4px 6px}}
  button{font:inherit;font-size:14px;color:var(--fg);background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 10px;cursor:pointer}
  button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  /* Hide read is a setting, not a section: a switch that stays put to the left of the section chips, which scroll. */
  .filters{display:flex;align-items:center;gap:10px;padding-top:8px}
  .filters:not(:has(nav button)) .read-toggle{border-right:0}
  .read-toggle{flex:none;display:inline-flex;align-items:center;gap:6px;border:0;border-right:1px solid var(--line);border-radius:0;padding:3px 10px 3px 0;color:var(--muted);font-size:13px;white-space:nowrap}
  .read-toggle::before{content:"";flex:none;width:28px;height:16px;border-radius:8px;background:var(--line) radial-gradient(circle at 8px 50%,#fff 5.5px,transparent 6px)}
  .read-toggle[aria-checked="true"]{color:var(--fg)}
  .read-toggle[aria-checked="true"]::before{background:var(--accent) radial-gradient(circle at 20px 50%,#fff 5.5px,transparent 6px)}
  nav{display:flex;gap:6px;overflow-x:auto;min-width:0;flex:1;scrollbar-width:none}
  nav::-webkit-scrollbar{display:none}
  nav button{white-space:nowrap;border-radius:999px}
  nav button[aria-current="true"]{background:var(--fg);border-color:var(--fg);color:var(--bg)}
  section{padding-top:20px;scroll-margin-top:110px}
  h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 2px}
  ol{list-style:none;margin:0;padding:0}
  li{padding:10px 0 10px 12px;border-bottom:1px solid var(--line)}
  li[data-tier="3"]{box-shadow:inset 3px 0 0 var(--accent)}
  li[data-tier="2"]{box-shadow:inset 3px 0 0 var(--muted)}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .view .bar button.save{padding:5px 8px;line-height:0;color:var(--muted)}
  .view .bar button.save svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
  .view .bar button.save[aria-pressed="true"]{color:var(--accent);border-color:var(--accent)}
  .view .bar button.save[aria-pressed="true"] .f{fill:currentColor}
  /* A long press on a card (touch screens) opens this small menu instead of the browser's own for the link. */
  main li[data-key],main li[data-key] a{-webkit-touch-callout:none}
  .hold{position:fixed;z-index:3;display:flex;flex-direction:column;min-width:210px;padding:6px;background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.28)}
  .hold[hidden]{display:none}
  .hold button{border:0;border-radius:8px;text-align:left;font-size:16px;padding:10px 12px}
  .hold button:active{background:var(--line)}
  .sec-label{display:inline-block;margin-left:6px;font-size:12px;color:var(--muted);vertical-align:2px}
  a.h{color:var(--fg);text-decoration:none;font-weight:600;font-size:17px;line-height:1.25}
  a.h:visited,li.read a.h{color:var(--muted)}
  a.h:hover{text-decoration:underline}
  p.lead{margin:3px 0 0;color:var(--muted);font-size:15px;line-height:1.33;min-height:5.32em;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;line-clamp:4;overflow:hidden}
  p.lead[hidden]{display:none}
  p.lead.wait{background:linear-gradient(var(--line),var(--line)) 0 .33em/92% .67em no-repeat,linear-gradient(var(--line),var(--line)) 0 1.66em/88% .67em no-repeat,linear-gradient(var(--line),var(--line)) 0 2.99em/90% .67em no-repeat,linear-gradient(var(--line),var(--line)) 0 4.32em/50% .67em no-repeat;border-radius:3px}
  .logo{display:inline-flex;align-items:center;padding:4px 8px;border-radius:6px;max-width:100%;box-sizing:border-box;vertical-align:middle}
  .logo svg,.logo img{display:block;height:26px;width:auto;max-width:min(200px,100%);object-fit:contain}
  @media (max-width: 480px){.logo svg,.logo img{height:22px}}
  .keys{display:none;color:var(--muted);font-size:13px;padding-top:6px}
  @media (hover: hover) and (pointer: fine){.keys{display:block}}
  main a.h:focus-visible{outline:none}
  main li[data-key]:focus-within,main li[data-key].kb{background:var(--paper);box-shadow:inset 0 0 0 2px var(--accent)}
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
  .reader iframe{display:block;width:100%;height:600px;margin:0 0 1em;border:0;border-radius:6px;background:#fff}
  .reader .term{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}
  .reader .term[aria-expanded="true"]{text-decoration-style:solid}
  .reader .explain{display:block;margin:8px 0 0;padding:8px 12px;font-size:15px;line-height:1.4;color:var(--muted);border-left:3px solid var(--line);background:color-mix(in srgb,var(--line) 35%,transparent);border-radius:0 6px 6px 0}
  .reader .explain[hidden]{display:none}
  .reader figcaption{font-size:14px;color:var(--muted);margin-top:4px}
  .reader .byline{font-size:14px;color:var(--muted);margin-bottom:14px}
  .reader .end{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding-top:8px;border-top:1px solid var(--line)}
  .reader .end a{color:var(--accent);font-weight:600;text-decoration:none}
  .reader .end a:hover{text-decoration:underline}
  /* Wide screens: the articles in columns. */
  @media (min-width: 1000px){
    .wrap{max-width:88rem}
    section > ol{display:grid;grid-template-columns:repeat(auto-fill,minmax(22rem,1fr));column-gap:32px}
    /* Sections with fewer articles than fill a row stand side by side, read down and then across, like a newspaper page;
       alone, each left most of its row empty (a short regional section, or one with the read articles hidden). */
    .cols{columns:22rem;column-gap:32px}
    .cols > section > ol{display:block}
    /* A section may go on in the next column, between two articles (so the columns come out even); its heading stays
       with its first article. */
    .cols li{break-inside:avoid;-webkit-column-break-inside:avoid}
    .cols h2{break-after:avoid;-webkit-column-break-after:avoid}
    .cols > section:first-child{padding-top:0;margin-top:20px}
  }
  li.pic{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:12px;align-items:start}
  /* The picture is part of the card: a click on it goes to the card. In Safari on a Mac, a click on a picture could start
     dragging it instead, and then nothing opened. */
  li.pic .pic-img{width:120px;height:80px;border-radius:6px;object-fit:cover;background:var(--line);display:block;pointer-events:none;-webkit-user-drag:none;user-select:none}
  @media (max-width: 480px){li.pic{grid-template-columns:minmax(0,1fr) 84px;gap:10px} li.pic .pic-img{width:84px;height:56px}}
  .paid{display:inline-block;margin-left:6px;padding:0 5px;border:1px solid var(--line);border-radius:4px;font-size:12px;color:var(--muted);vertical-align:2px}
  footer{color:var(--muted);font-size:13px;padding-top:24px}
  footer button{font-size:13px;padding:2px 8px;margin-top:6px}
  /* Sections are edited in the chip row itself: the pencil at its end shows every section, hidden ones too, wrapped
     on lines; a tap hides or shows one, a drag moves it, and Done keeps it. */
  .edit-secs{flex:none;border:0;padding:4px 2px 4px 8px;font-size:18px;line-height:1;color:var(--muted)}
  .filters.editing{flex-wrap:wrap;align-items:flex-start}
  .filters.editing .read-toggle{display:none}
  .filters.editing nav{flex-wrap:wrap;overflow:visible;flex-basis:100%;order:2}
  .filters.editing .edit-secs{order:1;margin-left:auto;font-size:14px;font-weight:600;padding:5px 12px;border-radius:999px;background:var(--accent);color:#fff}
  .edit-hint,.mix-note{margin:6px 0 0;font-size:13px;color:var(--muted)}
  h2 a.site-link{color:inherit;text-decoration:none}
  h2 a.site-link:hover{color:var(--accent)}
  nav button[data-id]{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
  nav button[data-id] small{color:var(--muted);font-size:12px;margin-left:4px}
  nav button[data-id][aria-pressed="false"]{opacity:.45;text-decoration:line-through;border-style:dashed}
  nav button[data-id].drag{outline:2px solid var(--accent);outline-offset:1px;opacity:1}`;


let plainHost = null, plainCount = 0;
// The page under the list is told it is light and dark, as our own view is. Dark-mode extensions (Noir) look at the page,
// not inside our shadow root: they saw a light page and laid their own dark colours over it, the list included. With
// color-scheme set, a page background in our colours, and our host's colours pinned, they see a page with its own dark mode.
function ownColors() {
  if (document.getElementById('nothis-scheme')) return;
  const meta = document.createElement('meta');
  meta.name = 'color-scheme'; meta.content = 'light dark'; meta.id = 'nothis-scheme-meta';
  for (const m of document.querySelectorAll('meta[name="color-scheme" i]')) m.remove();
  const st = document.createElement('style');
  st.id = 'nothis-scheme';
  st.textContent = ':root{color-scheme:light dark!important}' +
    'html,html>body,#declickbait-plain{background:#fbfbf9!important;color:#1d1d1b!important;filter:none!important}' +
    '@media (prefers-color-scheme: dark){html,html>body,#declickbait-plain{background:#1a1b1a!important;color:#e8e8e5!important}}';
  const head = document.head || document.documentElement;
  head.prepend(meta); head.appendChild(st);
}
// Hides the site's page and keeps its media silent. The body keeps its layout while harvest() scrolls
// it (lazy loading needs that), and is taken out of the page once it is done. Returns how to give it back.
function swallowSite() {
  const st = document.createElement('style');
  // The body itself stays visible and in the layout, emptied: Safari paints nothing while a page loads unless its body is
  // visible (see the cover in gm-shim.js), and on a page that never finishes loading the list was never painted.
  // Once the list is up, what is in the body is skipped by layout and paint, but keeps its boxes: with display:none, the
  // anti-adblock script on bild.de (Ad Shield, html-load.com) saw its bait ads without a size and sent the tab to its
  // adblock wall and back, again and again.
  st.textContent = 'html.cb-plain{overflow:hidden!important} html.cb-plain>body *{visibility:hidden!important;pointer-events:none!important} html.cb-plain.cb-plain-done>body>*{content-visibility:hidden!important}';
  document.head.appendChild(st);
  document.documentElement.classList.add('cb-plain');
  for (const m of document.querySelectorAll('video, audio')) try { m.pause(); m.muted = true; } catch {}
  document.addEventListener('play', e => { try { e.target.pause(); e.target.muted = true; } catch {} }, true);
  return () => { document.documentElement.classList.remove('cb-plain'); st.remove(); };
}
// An article's address that shows it as the site publishes it (boot.js), not in the reader.
const onSiteUrl = url => url.split('#')[0] + '#nothis-original';
// An embedded quiz tells its page how tall it is (Amedia's smart embeds); until then it has a height of its own.
const readerFrames = new Set();
function readerFrame(src) {
  if (!readerFrames.size) window.addEventListener('message', e => {
    if (e.data?.type !== 'amedia:mnemonic-iframe-resize' || !(e.data.value > 0)) return;
    for (const f of readerFrames) {
      if (!f.isConnected) readerFrames.delete(f);
      else if (f.contentWindow === e.source) f.style.height = Math.max(200, Math.min(+e.data.value, 5000)) + 'px';
    }
  });
  const f = document.createElement('iframe');
  f.title = 'Quiz'; f.loading = 'lazy'; f.src = src;
  readerFrames.add(f);
  return f;
}
const readerEl = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
// A paragraph with explained words (VG's "mistenkt", an <abbr>): the word, the first time it comes, is
// marked, and a tap shows what it means under the paragraph, so the sentence isn't split.
function readerTermsP(b) {
  const p = readerEl('p'), notes = [];
  const at = b.terms.map(t => ({ ...t, i: b.text.indexOf(t.w) })).filter(t => t.i >= 0).sort((x, y) => x.i - y.i);
  let pos = 0;
  for (const t of at) {
    if (t.i < pos) continue;
    p.append(b.text.slice(pos, t.i));
    const w = readerEl('button', t.w, 'term'), n = readerEl('span', '', 'explain');
    n.append(readerEl('b', t.w), ' ' + t.n); n.hidden = true;
    w.type = 'button'; w.setAttribute('aria-expanded', 'false');
    w.addEventListener('click', e => { e.stopPropagation(); n.hidden = !n.hidden; w.setAttribute('aria-expanded', String(!n.hidden)); });
    p.append(w); notes.push(n); pos = t.i + t.w.length;
  }
  p.append(b.text.slice(pos), ...notes);
  return p;
}
function readerContent(art, title, lede, url) {
  const el = readerEl, out = [el('h1', title)];
  if (lede) out.push(el('p', lede, 'lede'));
  const by = art && [art.byline, art.date && new Date(art.date).toLocaleString(T.lang === 'en' ? undefined : T.lang, { dateStyle: 'medium', timeStyle: 'short' })].filter(x => x && x !== 'Invalid Date').join(' · ');
  if (by) out.push(el('div', by, 'byline'));
  for (const b of art?.blocks || []) {
    if (b.t === 'p') out.push(b.terms ? readerTermsP(b) : el('p', b.text));
    else if (b.t === 'h') out.push(el('h3', b.text));
    else if (b.t === 'quote') out.push(el('blockquote', b.text));
    else if (b.t === 'list') { const l = el(b.ordered ? 'ol' : 'ul'); for (const t of b.items) l.append(el('li', t)); out.push(l); }
    else if (b.t === 'img') {
      const f = el('figure'), im = el('img');
      im.src = b.src; im.alt = b.caption || ''; im.loading = 'lazy'; im.decoding = 'async';
      im.addEventListener('error', () => f.remove());
      f.append(im); if (b.caption) f.append(el('figcaption', b.caption)); out.push(f);
    }
    else if (b.t === 'embed') out.push(readerFrame(b.src));
  }
  if (!art) out.push(el('p', T.unreadable, 'note')); // a video, live page or app: the site shows it
  else if (art.partial) out.push(el('p', T.paidHere, 'note'));
  else if (art.short) out.push(el('p', T.short, 'note')); // a story that has just broken, or a video with a caption
  let at = host; try { at = new URL(art.finalUrl).hostname.replace(/^www\./, ''); } catch {} // a sister site the article moved to
  const end = el('div', '', 'end'), site = el('a', T.onSite(at)), close = el('button', T.close);
  site.href = onSiteUrl(url); close.dataset.act = 'close-reader';
  // The site opens in a tab of its own (a frame is refused by most news sites): closing it brings you back to the reader,
  // where you were. A new tab also loads the page when the address bar already shows this article.
  site.target = '_blank'; site.rel = 'noopener';
  end.append(site);
  end.append(close); out.push(end);
  return out;
}
// An article opened directly (a link from elsewhere, or a reload while reading): the same reader, on
// its own over the hidden page. Close goes to the list. False when the page isn't an article that can
// be read, and then it stays as it is.
// One list over the page. Another copy of the engine (an older userscript still installed, say) lays its own, and its
// key handler, which ran first, moved the list underneath while this one stood still: its list goes, as soon as it comes.
function onlyList() {
  const drop = () => { for (const h of document.querySelectorAll('#declickbait-plain')) if (h !== plainHost) h.remove(); };
  drop();
  new MutationObserver(drop).observe(document.documentElement, { childList: true });
}
async function articleView(withImages) {
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent).join('');
  if (!/article/i.test(document.querySelector('meta[property="og:type"]')?.getAttribute('content') || '') && !/"@type"\s*:\s*\[?\s*"\w*Article"/.test(ld)) return false;
  const url = location.href.split('#')[0], title = norm(document.querySelector('h1')?.textContent) || document.title;
  const giveBack = swallowSite();
  // The article is in this page already: read it from here, at once. Only when that finds no text (a page that adds
  // its text with scripts later) is it fetched again, which in Safari could keep the screen blank for many seconds.
  let art = null;
  try { art = readArticle(document.documentElement.outerHTML, url, withImages); } catch {}
  timeMark('article-here-' + (art?.blocks.length || 0));
  if (!art || (!art.blocks.length && !art.partial)) art = await fetchArticle(url, withImages);
  timeMark('article');
  // A paid article can come with no text at all: its headline, lead and a note about the subscription.
  if (!art || (!art.blocks.length && !art.partial)) { giveBack(); return false; }
  const desc = norm(document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '');
  const lede = desc && !art.blocks.some(b => b.text?.startsWith(desc.slice(0, 40))) ? desc : '';
  document.documentElement.classList.add('cb-plain-done');
  plainHost = document.createElement('div');
  plainHost.id = 'declickbait-plain';
  const sh = plainHost.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>${PLAIN_CSS}</style><div class="view" role="dialog" aria-modal="true" tabindex="-1"><div class="bar"><div><span></span><button data-act="close-reader">✕ ${T.close}</button></div></div><article class="reader"></article></div>`;
  sh.querySelector('.bar span').textContent = title;
  sh.querySelector('.reader').replaceChildren(...readerContent(art, title, lede, url));
  document.documentElement.appendChild(plainHost); ownColors();
  onlyList();
  for (const id of ['nothis-cover', 'nothis-shot']) document.getElementById(id)?.remove();
  sh.querySelector('.view').focus({ preventScroll: true });
  const close = () => { if (history.state?.nothis) history.back(); else location.assign(location.origin + '/'); };
  sh.addEventListener('click', e => { if (e.target.closest('[data-act="close-reader"]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // After a reload, the list's history entry can still count as this document: load what it points to.
  window.addEventListener('popstate', () => location.reload());
  return true;
}
// mix: the My news page (mix.js) instead of a site's front page: { sites, load(add) }. Its articles come from several
// sites' front pages, read elsewhere and handed over through load(); one section per site.
async function plainView(withImages, mix) {
  timeMark('plain-view');
  // A heavy front page that gm-shim.js stopped before its scripts ran: its links come from a downloaded copy, read without
  // running anything (no layout either, so nothing is measured), and the logo from the list shown meanwhile.
  const stopped = !mix && !!globalThis.__wdStopped;
  let src = document;
  if (stopped) {
    try { src = parseHtml((await gm.xhr({ url: location.href, headers: { Accept: 'text/html' } })).responseText); } catch { return false; }
    Object.assign(pageMeta, readPageMeta(src));
    if (src.title) document.title = norm(src.title);
    timeMark('copy-read');
  }
  const listUrl = location.href, listTitle = document.title;
  // The logo is the first thing here that needs the page laid out, so it pays for the first layout: on nytimes.com in
  // Safari 1.2 s. It counts towards the first pass, which decides whether the page is heavy (the end of plainView).
  let logo = null, items = [], toLinks = 0, giveBack = () => {}, known = new Map();
  if (!mix) {
    const t0 = performance.now();
    if (stopped) {
      const chip = document.getElementById('nothis-shot')?.shadowRoot?.querySelector('h1 .logo');
      if (chip?.firstElementChild) logo = { el: chip.firstElementChild.cloneNode(true), bg: chip.style.background };
    } else try { logo = siteLogo(); } catch {} // before harvest() scrolls the page
    items = frontPageItems(undefined, !stopped, src);
    const firstPass = performance.now() - t0;
    timeMark('first-pass-' + Math.round(firstPass) + 'ms');
    if (items.length < 8 && !stopped) items = await frontPageSoon(8, 2400);
    toLinks = performance.now() - t0; // laying out, reading and waiting for enough links: heavy if long (see the end)
    timeMark('links');
    giveBack = swallowSite();
    known = new Map(items.map(it => [it.key, it]));
    if (items.length < 8 && !stopped) await harvest(known, fresh => items.push(...fresh), () => items.length >= 8);
    if (items.length < 8) {
      // Nothing to lay out: give the page back, and the caller falls back to the synopsis level.
      giveBack(); window.scrollTo(0, 0);
      return false;
    }
  }
  rankItems(items);
  let sortMode = startup.plainSort === 'importance' ? 'importance' : 'site';
  const layoutKey = mix ? 'mix' : host, layout = (startup.plainLayout || {})[layoutKey] || { hidden: [], order: [] };
  // Articles opened here, kept for 30 days on every site. With "hide read" on, those read before this visit are left out
  // of the list, like an inbox showing only unread mail; one read now stays (dimmed) until the next visit, or until the
  // button is pressed.
  let hideRead = !!startup.plainHideRead, showReadNow = false;
  const readBefore = new Set(Object.keys(startup.plainRead || {})), hiddenRead = new Set();
  // Read on another device (background.js syncs them): short hashes of the addresses, the last 14 days.
  const readHash = k => { let h = 0x811c9dc5; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const readElsewhere = new Set(Object.keys(startup.plainReadSync || {})), readThere = key => readElsewhere.has(readHash(key));
  const skipRead = it => hideRead && !showReadNow && (readBefore.has(it.key) || readThere(it.key));
  const saveRead = key => gm.get('plainRead', {}).then(all => {
    const now = Date.now(), kept = Object.entries({ ...(all || {}), [key]: now }).filter(([, t]) => now - t < 30 * 864e5).sort((a, b) => b[1] - a[1]).slice(0, 3000);
    return gm.set('plainRead', Object.fromEntries(kept));
  });
  if (!mix) readSectionNames(src);
  else for (const st of mix.sites) sectionNames.set(st.host, st.name);

  plainHost = document.createElement('div');
  plainHost.id = 'declickbait-plain';
  const sh = plainHost.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>${PLAIN_CSS}</style>
    <div class="wrap"><header><div class="top"><h1></h1><button data-act="sort"></button><button data-act="original">${T.original}</button></div><div class="filters"><button class="read-toggle" data-act="hide-read" role="switch"></button><nav aria-label="${T.sections}"></nav><button class="edit-secs" data-act="sections" aria-label="${T.editSections}" title="${T.editSections}">✎</button></div><p class="edit-hint" hidden>${T.editHint}</p><p class="mix-note" hidden></p></header>
    <main></main><footer></footer><div class="keys"></div></div>
    <div class="hold" hidden role="menu"></div>
    <div class="view" hidden role="dialog" aria-modal="true" tabindex="-1"><div class="bar"><div><span></span><button class="save" data-act="later" aria-pressed="false" aria-label="${T.later}" title="${T.later} (L)"><svg aria-hidden="true" viewBox="0 0 24 24"><circle class="f" cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke="var(--bg)"/></svg></button><button class="save" data-act="mark" aria-pressed="false" aria-label="${T.mark}" title="${T.mark} (B)"><svg aria-hidden="true" viewBox="0 0 24 24"><path class="f" d="M6 3h12v18l-6-4.5L6 21z"/></svg></button><button data-act="prev" aria-label="${T.prev}">‹</button><button data-act="next" aria-label="${T.next}">›</button><button data-act="close-reader"></button></div></div><article class="reader"></article></div>`;
  const h1 = sh.querySelector('h1'), mixNote = sh.querySelector('.mix-note');
  if (logo) {
    const chip = document.createElement('span'), name = document.createElement('span');
    chip.className = 'logo'; chip.style.background = logo.bg; chip.append(logo.el);
    name.className = 'sr'; name.textContent = pageMeta.site || host;
    h1.append(chip, name);
  } else h1.textContent = mix ? T.myNews : pageMeta.site || host;
  if (mix) sh.querySelector('[data-act="original"]').hidden = true;
  sh.querySelector('.keys').textContent = T.keys;
  document.documentElement.appendChild(plainHost); ownColors();
  onlyList();
  document.getElementById('nothis-cover')?.remove();
  // Remember the site, so next time the extension covers it before the original is drawn.
  if (!mix) gm.get('plainHosts', []).then(hs => gm.set('plainHosts', [host, ...(hs || []).filter(h => h !== host)].slice(0, 300)));

  const sections = new Map(), byKey = new Map();
  const add = it => { if (!byKey.has(it.key)) byKey.set(it.key, it); if (!sections.has(it.section)) sections.set(it.section, []); sections.get(it.section).push(it); };
  // Read later and Bookmarks: a site's list shows the articles saved from that site, first; My news shows them all
  // (unless hidden or moved like any
  // section). Read later is a queue, and an article leaves it once it has been read; a bookmark stays until it is taken
  // away. Kept in extension storage, so every site sees the same lists.
  const SAVED = { later: 'saved-later', marks: 'saved-marks' }, isSaved = id => id === SAVED.later || id === SAVED.marks;
  const saved = { later: [...(startup.plainSaved?.later || [])], marks: [...(startup.plainSaved?.marks || [])] };
  sections.set(SAVED.later, []); sections.set(SAVED.marks, []);
  // My news: the sites in the order they are read most, whichever front page comes in first.
  if (mix) for (const st of mix.sites) sections.set(st.host, []);
  items.forEach(add);
  const syncSaved = () => {
    for (const kind of ['later', 'marks']) {
      const list = sections.get(SAVED[kind]); list.length = 0;
      for (const s of saved[kind]) {
        // On a site's own list, only what was saved from that site; My news has all of it, from every site.
        if (!mix && (s.host || host) !== host) continue;
        const it = byKey.get(s.key) || { ...s, section: SAVED[kind] };
        byKey.set(s.key, it); list.push(it);
      }
    }
  };
  syncSaved();
  const isIn = (kind, key) => saved[kind].some(s => s.key === key);
  // The headline and lead as the list shows them, so a saved article looks the same in another site's list.
  const savedEntry = it => {
    const li = rows.get(it.key), m = cache[it.key];
    return { key: it.key, url: it.url, teaser: li?.querySelector('a.h')?.textContent || it.teaser, desc: li?.querySelector('p.lead')?.textContent || it.desc || '',
      img: it.img || (m && !m.err && m.image) || '', host: it.host || host, at: Date.now() };
  };
  // Another tab may have changed the lists meanwhile: the change is made to what is stored now.
  async function storeSaved(kind, entry, on) {
    const st = (await gm.get('plainSaved', {})) || {};
    st[kind] = [...(on ? [entry] : []), ...(st[kind] || []).filter(s => s.key !== entry.key)].slice(0, 500);
    await gm.set('plainSaved', st);
  }
  let savedChanged = false;
  function toggleSaved(kind, it) {
    if (!it) return;
    const on = !isIn(kind, it.key), entry = savedEntry(it);
    saved[kind] = [...(on ? [entry] : []), ...saved[kind].filter(s => s.key !== it.key)];
    storeSaved(kind, entry, on);
    showSavedButtons();
    if (current) savedChanged = true; else render();
  }
  function showSavedButtons() {
    for (const kind of ['later', 'marks']) view.querySelector(`[data-act="${kind === 'later' ? 'later' : 'mark'}"]`).setAttribute('aria-pressed', String(!!current && isIn(kind, current.key)));
  }
  // Sections in the order the user chose, then the rest in order of first appearance on the page; the saved lists first
  // until they are moved.
  const order = () => {
    const rest = [...sections.keys()].filter(id => !layout.order.includes(id));
    return [...rest.filter(isSaved), ...layout.order.filter(id => sections.has(id)), ...rest.filter(id => !isSaved(id))];
  };

  const main = sh.querySelector('main'), nav = sh.querySelector('nav'), rows = new Map(), want = [];
  // The section being read has its chip marked, and the chip is kept in sight in the row: as the list scrolls, and at once
  // when a chip is pressed (the list may not move, at the end of it).
  let spyPin = null, spyFrame = 0;
  const spy = () => {
    spyFrame = 0;
    const chips = [...nav.querySelectorAll('button[data-sec]')]; if (!chips.length) return;
    let cur = spyPin && sh.getElementById(spyPin);
    if (!cur) {
      const line = sh.querySelector('header').getBoundingClientRect().bottom + 24;
      // Sections side by side (.cols) are passed together: the last one whose top is above the line, in reading order.
      for (const sec of main.querySelectorAll('section')) if (sec.getBoundingClientRect().top <= line) cur = sec;
      // At the very end, the last section: one too short to reach the top is still the one being read.
      if (plainHost.scrollTop > 0 && plainHost.scrollTop + plainHost.clientHeight >= plainHost.scrollHeight - 2) cur = [...main.querySelectorAll('section')].pop();
      cur ||= main.querySelector('section');
    }
    for (const c of chips) {
      const on = c.dataset.sec === cur?.id;
      if (on === (c.getAttribute('aria-current') === 'true')) continue;
      if (on) {
        c.setAttribute('aria-current', 'true');
        const n = nav.getBoundingClientRect(), r = c.getBoundingClientRect();
        if (r.left < n.left || r.right > n.right) nav.scrollLeft += r.left - n.left - (n.width - r.width) / 2;
      } else c.removeAttribute('aria-current');
    }
  };
  plainHost.addEventListener('scroll', () => { spyFrame ||= requestAnimationFrame(spy); }, { passive: true });
  // A touch or wheel on the list lets go of a chip that was pressed.
  for (const ev of ['wheel', 'touchstart', 'keydown']) plainHost.addEventListener(ev, () => { if (spyPin) { spyPin = null; spy(); } }, { passive: true });
  // What has the keyboard focus in the list. Safari leaves shadowRoot.activeElement empty in an extension's world, so the
  // arrow keys and j/k always started again from the top there: the focus is followed by its events as well.
  let lastFocus = null;
  sh.addEventListener('focusin', e => { lastFocus = e.target; });
  sh.addEventListener('focusout', e => { if (lastFocus === e.target) lastFocus = null; });
  const focused = () => sh.activeElement || (lastFocus?.isConnected ? lastFocus : null);
  // The keyboard's place in the list, kept here and marked with .kb: in Safari's extension world focus() doesn't reliably
  // land in the list, so the arrow keys, j/k, Enter and o go by this, not by the focus. A click on a card moves it there.
  let cursorKey = null;
  const cursor = () => { const li = cursorKey && rows.get(cursorKey); return li?.isConnected ? li : null; };
  const mark = li => { for (const o of main.querySelectorAll('li.kb')) if (o !== li) o.classList.remove('kb'); li?.classList.add('kb'); };
  // The list fills in after it is shown: leads, better headlines, rows dropped for a muted topic. Safari has no scroll
  // anchoring, so a row growing above the screen pushed the list down under the reader, and a click could land on the
  // next card. The row at the top of the screen is held in place here instead, alike in every browser (overflow-anchor
  // is off on the host). While a card is pressed nothing changes: the changes wait for the release.
  function steady(change) {
    if (pressed) { held.push(change); return; }
    const top = sh.querySelector('header').getBoundingClientRect().bottom;
    const anchor = plainHost.scrollTop > 0 && [...main.querySelectorAll('li[data-key]')].find(li => li.getBoundingClientRect().bottom > top);
    const before = anchor && anchor.getBoundingClientRect().top;
    change();
    if (anchor?.isConnected) plainHost.scrollTop += anchor.getBoundingClientRect().top - before;
  }
  let pressed = null; const held = [];
  const release = () => { if (!pressed) return; setTimeout(() => { pressed = null; const all = held.splice(0); if (all.length) steady(() => all.forEach(f => f())); }); };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  // A row whose article is still to be fetched keeps four lines free for its lead (p.lead.wait), and every lead takes
  // those four lines, no more (the whole of it is in the article view): the cards are alike, and a lead coming in
  // doesn't push the list down.
  function fill(it, li, fetched = false) {
    const m = cache[it.key];
    if (m && !m.err && mutedTopicOf(it.url, it.teaser, m)) { dropRow(it.key, li); return; }
    const meta = m && !m.err ? cleanMeta(m, it.url) : it.desc ? { title: '', desc: it.desc } : null;
    const { text, lead } = choose(it.teaser, meta);
    const a = li.querySelector('a.h'), p = li.querySelector('p.lead');
    a.textContent = text;
    if (norm(text) !== norm(it.teaser)) a.title = 'Original: ' + it.teaser;
    const waiting = !lead && !m && !fetched && CFG.fetch;
    p.textContent = lead; p.hidden = !lead && !waiting; p.classList.toggle('wait', waiting);
    const im = li.querySelector('.pic-img');
    const src = im && (it.img || (m && !m.err && m.image) || '');
    if (src && im.getAttribute('src') !== src) im.src = src;
  }
  // The count, and how many read articles were left out, with a button that shows them on this visit.
  function updateFooter() {
    const f = sh.querySelector('footer');
    f.replaceChildren(`${T.count(rows.size)} · ${host} · ${(typeof GM !== 'undefined' && GM.info?.script?.name) || 'Declickbait'}`);
    if (!hiddenRead.size) return;
    const b = document.createElement('button'); b.dataset.act = 'show-read'; b.textContent = T.showRead;
    f.append(document.createElement('br'), `${T.readHidden(hiddenRead.size)} · `, b);
  }
  // An article whose metadata reveals a muted topic leaves the page, and its section too once empty.
  function dropRow(key, li) {
    const sec = li.closest('section');
    li.remove(); rows.delete(key); plainCount = rows.size;
    if (sec && !sec.querySelector('li')) { nav.querySelector(`[data-sec="${sec.id}"]`)?.remove(); const run = sec.parentElement; sec.remove(); if (run?.classList.contains('cols') && !run.children.length) run.remove(); }
    updateFooter();
  }
  const seenRows = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { const i = want.indexOf(e.target.dataset.key); if (i > 0) want.unshift(...want.splice(i, 1)); prefetch(e.target.dataset.key); }
    pumpPlain();
  }, { rootMargin: '400px' });
  // Fetched articles go into the list together, a few times a second, rather than one change after another.
  let running = 0, fillTimer = null; const toFill = new Set();
  const fillSoon = key => {
    toFill.add(key);
    fillTimer ||= setTimeout(() => {
      fillTimer = null; const keys = [...toFill]; toFill.clear();
      steady(() => { for (const k of keys) { const li = rows.get(k); if (li?.isConnected) fill(byKey.get(k), li, true); } });
    }, 250);
  };
  function pumpPlain() {
    while (running < CFG.concurrency && want.length) {
      const key = want.shift(), it = byKey.get(key);
      running++;
      // Never longer than 40 s in a slot: a fetch that hangs would otherwise stop the queue, and the cards after it kept
      // their grey placeholder bars for good.
      Promise.race([getMeta(it.url), new Promise(r => setTimeout(r, 40000))]).finally(() => { running--; fillSoon(key); pumpPlain(); });
    }
  }
  // The cards of the list being replaced (render): a card that would look the same is moved into the new list as it
  // is, its importance mark brought up to date. Built anew, every picture went blank for a moment while it was decoded
  // again, also the ones long loaded.
  let oldRows = null;
  const setTier = (li, tier) => {
    li.querySelector(':scope > .sr')?.remove();
    if (tier > 1) {
      // The front page's own sense of importance, as a quiet bar instead of big type.
      li.dataset.tier = tier;
      const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = (tier === 3 ? T.top : T.important) + ': ';
      li.prepend(sr);
    } else delete li.dataset.tier;
  };
  function row(it, withSection) {
    const look = `${withSection ? 1 : 0}${it.paid ? 1 : 0}`, prev = oldRows?.get(it.key);
    if (prev && prev.dataset.look === look) {
      if ((+prev.dataset.tier || 1) !== (it.tier || 1)) setTier(prev, it.tier);
      rows.set(it.key, prev);
      if (prev.querySelector('p.lead.wait') && !want.includes(it.key)) want.push(it.key);
      seenRows.observe(prev);
      return prev;
    }
    const li = document.createElement('li'), a = document.createElement('a'), p = document.createElement('p');
    li.dataset.look = look;
    a.href = it.url; a.className = 'h'; a.dataset.key = it.key; p.className = 'lead'; li.dataset.key = it.key;
    // Safari on a Mac only lets a link take focus when "Press Tab to highlight each item" is on, so without this the
    // arrow keys, j/k, Enter and o found no headline to start from or open.
    a.tabIndex = 0;
    setTier(li, it.tier);
    const text = withImages ? document.createElement('div') : li;
    text.append(a);
    if (it.paid) { const b = document.createElement('span'); b.className = 'paid'; b.textContent = T.paid; text.append(b); }
    // The site, for an article from elsewhere: a saved one, or one in My news shown outside its site's section.
    const from = it.host && it.host !== host && it.section !== it.host ? it.host.replace(/^www\./, '') : '';
    if (withSection || from) { const sl = document.createElement('span'); sl.className = 'sec-label'; sl.textContent = from || sectionLabel(it.section); text.append(sl); }
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
    if (readKeys.has(it.key) || readThere(it.key)) li.classList.add('read');
    return li;
  }

  // Reading in place: a card opens its article full screen over the list, which stays where it was.
  // Close, Escape and the browser's back (swipe back on a phone) return to the list.
  const el = readerEl;
  const view = sh.querySelector('.view'), reader = view.querySelector('.reader'), readKeys = new Set(readBefore);
  view.querySelector('[data-act="close-reader"]').textContent = '✕ ' + T.close;
  let current = null; // the article on screen
  const doneLater = new Set(); // read from Read later while the reader was open: they leave it when it closes
  // replace: moving to the previous/next article, which shouldn't stack up in the history.
  function openArticle(it, replace, fromHistory) {
    const li = rows.get(it.key);
    current = it; li?.classList.add('read');
    if (isIn('later', it.key)) doneLater.add(it.key);
    if (!readKeys.has(it.key)) { readKeys.add(it.key); saveRead(it.key); }
    view.querySelector('.bar span').textContent = li?.querySelector('a.h').textContent || it.teaser;
    const list = cards(), i = list.indexOf(li);
    view.querySelector('[data-act="prev"]').disabled = i <= 0;
    view.querySelector('[data-act="next"]').disabled = i < 0 || i >= list.length - 1;
    reader.replaceChildren(el('p', T.loading, 'note'));
    // While an article is open, the list behind it is out of reach for a screen reader (and so a braille display) and
    // for the Tab key: the article is all there is, and it is named by its headline.
    sh.querySelector('.wrap').inert = true;
    view.setAttribute('aria-label', li?.querySelector('a.h').textContent || it.teaser);
    view.hidden = false; view.scrollTop = 0; view.focus({ preventScroll: true });
    // The address bar shows the article, so it can be copied or reloaded. A browser only allows that
    // within the site: an article on another site keeps the list's address.
    let url = listUrl; try { if (new URL(it.url).origin === location.origin) url = it.url; } catch {}
    if (!fromHistory) try { history[replace ? 'replaceState' : 'pushState']({ nothis: it.key }, '', url); } catch {}
    document.title = li?.querySelector('a.h').textContent || it.teaser;
    showSavedButtons();
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
  const neighbour = d => { const list = cards(), li = current && rows.get(current.key); return list[list.indexOf(li) + d]; };

  // Swiping on a touch screen: left for the next article, right for the previous. The article
  // follows the finger like a card in a carousel and slides out as the next one slides in; a swipe
  // past a quarter of the width, or a quick flick, changes article. "Animate swiping" off in the
  // settings, or reduced motion, changes article without the movement.
  const motion = () => CFG.swipeAnimation && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let swipe = null, sliding = false;
  view.addEventListener('touchstart', e => {
    const t = e.touches[0];
    swipe = e.touches.length === 1 && !sliding ? { x: t.clientX, y: t.clientY, t: Date.now(), dx: 0, dir: '' } : null;
  }, { passive: true });
  view.addEventListener('touchmove', e => {
    if (!swipe || e.touches.length !== 1) return;
    const t = e.touches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
    if (!swipe.dir) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      swipe.dir = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v';
    }
    if (swipe.dir !== 'h') return;
    e.preventDefault(); // a sideways swipe doesn't scroll the article
    swipe.dx = dx;
    // Past the first or last article the card only gives a little.
    if (motion()) reader.style.transform = `translateX(${neighbour(dx < 0 ? 1 : -1) ? dx : dx / 4}px)`;
  }, { passive: false });
  const endSwipe = cancel => {
    const sw = swipe; swipe = null;
    if (!sw || sw.dir !== 'h') return;
    const w = view.clientWidth, d = sw.dx < 0 ? 1 : -1;
    const fast = Math.abs(sw.dx) > 50 && Math.abs(sw.dx) / Math.max(1, Date.now() - sw.t) > 0.5; // a flick: over 0.5 px/ms
    const go = !cancel && neighbour(d) && (Math.abs(sw.dx) > w / 4 || fast);
    if (!motion()) { reader.style.transform = ''; if (go) step(d); return; }
    const from = `translateX(${sw.dx}px)`, ease = 'cubic-bezier(.2,.7,.3,1)';
    if (!go) { reader.animate([{ transform: from }, { transform: 'none' }], { duration: 180, easing: ease }); reader.style.transform = ''; return; }
    sliding = true;
    reader.animate([{ transform: from, opacity: 1 }, { transform: `translateX(${-d * w}px)`, opacity: .4 }], { duration: 160, easing: 'ease-in' }).finished.then(() => {
      step(d);
      reader.style.transform = '';
      return reader.animate([{ transform: `translateX(${d * w}px)`, opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: ease }).finished;
    }).finally(() => { sliding = false; });
  };
  view.addEventListener('touchend', () => endSwipe(false));
  view.addEventListener('touchcancel', () => endSwipe(true));
  function focusCard(li) { cursorKey = li.dataset.key; mark(li); li.querySelector('a.h')?.focus({ preventScroll: true }); li.scrollIntoView({ block: 'nearest' }); }

  // Articles are fetched ahead so they open at once: the ones on screen (a few at a time, up to 40
  // per visit), and right away the one under the pointer or keyboard focus and the neighbours of the
  // one being read. A page is read for the reader only when it opens (fetchArticle), so scrolling
  // and tapping stay quick. Pages fetched for the headlines are reused (articleFetched in reader.js).
  // One fetched more than two minutes ago is fetched again before it opens: the story may have grown.
  readerFor = true;
  const ahead = [];
  let aheadRunning = 0, aheadLeft = 40;
  const FRESH = 2 * 60 * 1000;
  function prefetch(key, now) {
    const it = byKey.get(key); if (!it) return;
    if (now) { fetchArticle(it.url, withImages, FRESH, false); return; }
    if (readerCache.has(it.url)) return;
    if (aheadLeft > 0 && !ahead.includes(key)) { ahead.push(key); aheadLeft--; pumpAhead(); }
  }
  function pumpAhead() {
    while (aheadRunning < 2 && ahead.length) {
      const it = byKey.get(ahead.shift()); if (!it) continue;
      aheadRunning++;
      paced().then(() => fetchArticle(it.url, withImages, Infinity, false)).finally(() => { aheadRunning--; pumpAhead(); });
    }
  }
  // A click or tap on a card puts the keyboard's place there, so the arrow keys go on from it.
  main.addEventListener('pointerdown', e => { const li = e.target.closest?.('li[data-key]'); if (li) { pressed = li; cursorKey = li.dataset.key; mark(li); } }, { capture: true, passive: true });
  // A long press on a card (half a second, without moving) opens a small menu to save it for later or bookmark it; the
  // tap that ends the press does not open the article. A tap elsewhere, a scroll or Esc closes the menu.
  const holdMenu = sh.querySelector('.hold');
  let holdTimer = 0, holdAt = null, holdDone = false;
  const closeHold = () => { holdMenu.hidden = true; holdMenu.replaceChildren(); };
  function openHold(li, x, y) {
    const it = byKey.get(li.dataset.key); if (!it) return;
    holdDone = true; cursorKey = li.dataset.key; mark(li);
    holdMenu.replaceChildren(...[['later', isIn('later', it.key) ? T.unLater : T.later], ['marks', isIn('marks', it.key) ? T.unMark : T.mark]].map(([kind, label]) => {
      const b = document.createElement('button'); b.setAttribute('role', 'menuitem'); b.textContent = label;
      b.addEventListener('click', e => { e.stopPropagation(); closeHold(); toggleSaved(kind, it); });
      return b;
    }));
    holdMenu.hidden = false;
    const r = holdMenu.getBoundingClientRect();
    holdMenu.style.left = Math.max(8, Math.min(x - r.width / 2, innerWidth - r.width - 8)) + 'px';
    holdMenu.style.top = (y - r.height - 16 > 8 ? y - r.height - 16 : Math.min(y + 16, innerHeight - r.height - 8)) + 'px';
  }
  main.addEventListener('touchstart', e => {
    const li = e.target.closest?.('li[data-key]'); if (!li || e.touches.length > 1) return;
    const t = e.touches[0]; holdAt = { x: t.clientX, y: t.clientY }; holdDone = false;
    clearTimeout(holdTimer); holdTimer = setTimeout(() => openHold(li, holdAt.x, holdAt.y), 500);
  }, { passive: true });
  main.addEventListener('touchmove', e => { const t = e.touches[0]; if (holdAt && Math.hypot(t.clientX - holdAt.x, t.clientY - holdAt.y) > 10) clearTimeout(holdTimer); }, { passive: true });
  main.addEventListener('touchend', e => { clearTimeout(holdTimer); if (holdDone) e.preventDefault(); }, { passive: false });
  main.addEventListener('touchcancel', () => clearTimeout(holdTimer), { passive: true });
  main.addEventListener('contextmenu', e => { if (holdDone) e.preventDefault(); });
  // The click that ends a long press is not a tap on the card.
  main.addEventListener('click', e => { if (holdDone) { holdDone = false; e.preventDefault(); e.stopPropagation(); } }, true);
  sh.addEventListener('pointerdown', e => { if (!holdMenu.hidden && !holdMenu.contains(e.target)) closeHold(); }, true);
  plainHost.addEventListener('scroll', () => { if (!holdMenu.hidden) closeHold(); }, { passive: true });
  sh.addEventListener('keydown', e => { if (e.key === 'Escape' && !holdMenu.hidden) { e.stopPropagation(); closeHold(); } }, true);
  for (const ev of ['pointerenter', 'focusin', 'touchstart']) main.addEventListener(ev, e => {
    const li = e.target.closest?.('li[data-key]'); if (li) prefetch(li.dataset.key, true);
  }, { capture: true, passive: true });
  function closeArticle(fromHistory) {
    if (!current) return;
    const key = current.key;
    current = null; view.hidden = true; reader.replaceChildren(); sh.querySelector('.wrap').inert = false;
    document.title = listTitle;
    if (!fromHistory) history.back();
    let back = key;
    for (const k of doneLater) { const s = saved.later.find(x => x.key === k); if (s) { saved.later = saved.later.filter(x => x !== s); storeSaved('later', s, false); savedChanged = true; } }
    doneLater.clear();
    if (savedChanged && !(hideRead && !showReadNow)) {
      // The card leaves Read later (or comes into a saved list): the keyboard goes on from the next card.
      const list = cards(), i = list.indexOf(rows.get(key));
      savedChanged = false; render();
      if (!rows.get(key)?.isConnected) back = list.slice(i + 1).find(l => rows.get(l.dataset.key)?.isConnected)?.dataset.key;
    }
    savedChanged = false;
    if (hideRead && !showReadNow) {
      // With "hide read" on, what was read leaves the list on the way back to it, and the keyboard goes on from the next
      // unread card (the one before, at the end). The cards around keep their place: render() holds the one on top.
      const list = cards(), i = list.indexOf(rows.get(key)), unread = l => !readKeys.has(l.dataset.key) && !readThere(l.dataset.key);
      back = (list.slice(i + 1).find(unread) || list.slice(0, Math.max(i, 0)).reverse().find(unread))?.dataset.key;
      for (const k of readKeys) readBefore.add(k);
      render();
    }
    const li = back && rows.get(back); if (li) { cursorKey = back; mark(li); li.querySelector('a.h')?.focus({ preventScroll: true }); }
  }
  // Back closes the article; forward opens it again. By address: a site's own router can replace history.state.
  window.addEventListener('popstate', () => {
    const it = location.href === listUrl ? null : [...byKey.values()].find(i => i.url === location.href) || byKey.get(history.state?.nothis);
    if (it) openArticle(it, false, true); else closeArticle(true);
  });
  async function fillReader(it) {
    const art = await fetchArticle(it.url, withImages, FRESH);
    if (current !== it) return; // closed, or another one opened meanwhile
    const li = rows.get(it.key), lede = li?.querySelector('p.lead')?.textContent;
    reader.replaceChildren(...readerContent(art, li?.querySelector('a.h').textContent || it.teaser, lede, it.url));
  }
  function renderSection(id) {
    const ol = document.createElement('ol');
    for (const it of sections.get(id)) {
      if (rows.has(it.key)) continue; // an article in two sections is shown once
      if (skipRead(it) && !isSaved(id)) { hiddenRead.add(it.key); continue; } // a saved article stays until it is taken out
      const li = row(it, false); if (li) ol.append(li);
    }
    if (!ol.childElementCount) return;
    const sec = document.createElement('section'), h2 = document.createElement('h2'), chip = document.createElement('button');
    sec.id = 's-' + id; chip.dataset.sec = sec.id; h2.textContent = chip.textContent = sectionLabel(id);
    // My news: a site's heading leads to the site, where its own list opens.
    const st = mix?.sites.find(x => x.host === id);
    if (st) { const a = document.createElement('a'); a.href = st.origin + '/'; a.textContent = sectionLabel(id) + ' →'; a.className = 'site-link'; h2.replaceChildren(a); }
    chip.addEventListener('click', () => { spyPin = sec.id; sec.scrollIntoView(); spy(); });
    sec.append(h2, ol); main.append(sec); nav.append(chip);
  }
  // Runs of small sections go into one .cols box, which lays them side by side on a wide screen (CSS above); on a phone
  // the box changes nothing. A section is small when it has fewer articles than the three a row holds.
  function groupSmall() {
    let run = null;
    for (const sec of [...main.children]) {
      if (!(sec.tagName === 'SECTION' && sec.querySelectorAll('li[data-key]').length < 3)) { run = null; continue; }
      if (!run) { run = document.createElement('div'); run.className = 'cols'; sec.before(run); }
      run.append(sec);
    }
    for (const box of main.querySelectorAll(':scope > .cols')) if (box.children.length < 2) box.replaceWith(...box.children);
  }
  function render() {
    // Keep the article at the top of the screen in place when the list changes around it.
    const y = plainHost.scrollTop, top = sh.querySelector('header').getBoundingClientRect().bottom;
    const anchor = [...main.querySelectorAll('li[data-key]')].find(li => li.getBoundingClientRect().bottom > top);
    const anchorKey = anchor?.dataset.key, anchorTop = anchor?.getBoundingClientRect().top;
    // The headline that has the keyboard focus keeps it: the list is built anew, and the arrow keys and j/k go on from there.
    const focusKey = focused()?.closest?.('main li[data-key]')?.dataset.key;
    syncSaved();
    oldRows = new Map(rows);
    main.replaceChildren(); nav.replaceChildren(); rows.clear(); want.length = 0; seenRows.disconnect(); hiddenRead.clear();
    // Read articles in or out of the list, like unread-only mail.
    const readToggle = sh.querySelector('.read-toggle');
    readToggle.textContent = T.hideRead; readToggle.setAttribute('aria-checked', String(hideRead && !showReadNow));
    sh.querySelector('[data-act="sort"]').textContent = sortMode === 'importance' ? T.siteOrder : T.byImportance;
    if (sortMode === 'importance') {
      // One list across the visible sections, loudest on the front page first; feed-only items last.
      const ol = document.createElement('ol'), seenKeys = new Set();
      for (const id of order()) if (isSaved(id) && !layout.hidden.includes(id)) renderSection(id);
      const all = order().filter(id => !isSaved(id) && !layout.hidden.includes(id)).flatMap(id => sections.get(id))
        .filter(it => !seenKeys.has(it.key) && seenKeys.add(it.key) && !(skipRead(it) && hiddenRead.add(it.key))).sort((a, b) => (b.score || 0) - (a.score || 0));
      for (const it of all) if (!rows.has(it.key)) { const li = row(it, true); if (li) ol.append(li); }
      const sec = document.createElement('section'), h2 = document.createElement('h2');
      sec.id = 's-importance'; h2.textContent = T.byImportance;
      sec.append(h2, ol); main.append(sec);
    }
    else for (const id of order()) if (!layout.hidden.includes(id)) renderSection(id);
    groupSmall();
    plainCount = rows.size;
    updateFooter();
    plainHost.scrollTop = y;
    const again = y > 0 && anchorKey && rows.get(anchorKey); // at the top, the top it stays
    if (again) plainHost.scrollTop += again.getBoundingClientRect().top - anchorTop;
    if (focusKey) rows.get(focusKey)?.querySelector('a.h')?.focus({ preventScroll: true });
    if (cursor()) mark(cursor());
    oldRows = null;
    if (editing) showEditChips();
    spy();
    pumpPlain();
  }

  // Section editing, in the chip row: every section, hidden ones dimmed. A tap (or Enter) hides or shows one, a drag (or
  // Alt+← →) moves it, Done or Esc keeps the changes. Remembered per host, for both sort orders.
  const filters = sh.querySelector('.filters'), editBtn = sh.querySelector('.edit-secs'), editHint = sh.querySelector('.edit-hint');
  let editing = null; // { order: [ids], hidden: Set }
  function showEditChips() {
    const ids = [...editing.order.filter(id => sections.has(id)), ...order().filter(id => !editing.order.includes(id))];
    editing.order = ids;
    nav.replaceChildren(...ids.map(id => {
      const c = document.createElement('button'), n = document.createElement('small');
      c.dataset.id = id; c.textContent = sectionLabel(id); n.textContent = sections.get(id).length; c.append(n);
      c.setAttribute('aria-pressed', String(!editing.hidden.has(id)));
      return c;
    }));
  }
  function startEditing() {
    editing = { order: order(), hidden: new Set(layout.hidden) };
    filters.classList.add('editing'); editHint.hidden = false;
    editBtn.textContent = T.done; editBtn.removeAttribute('aria-label');
    showEditChips();
    nav.querySelector('button')?.focus({ preventScroll: true });
  }
  async function finishEditing() {
    if (!editing) return;
    layout.order = editing.order; layout.hidden = editing.order.filter(id => editing.hidden.has(id)); layout.at = Date.now(); // newest wins in sync
    editing = null;
    filters.classList.remove('editing'); editHint.hidden = true;
    editBtn.textContent = '✎'; editBtn.setAttribute('aria-label', T.editSections);
    render();
    editBtn.focus({ preventScroll: true });
    await gm.set('plainLayout', { ...((await gm.get('plainLayout', {})) || {}), [layoutKey]: layout });
  }
  const keepOrder = () => { if (editing) editing.order = [...nav.querySelectorAll('button[data-id]')].map(c => c.dataset.id); };
  // A drag moves the chip in the row as the finger goes, to the place under it. Short of 8 px it is a tap.
  let drag = null, dragged = false;
  nav.addEventListener('pointerdown', e => {
    const c = editing && e.button === 0 && e.target.closest('button[data-id]'); if (!c) return;
    drag = { c, x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
    c.setPointerCapture?.(e.pointerId);
  });
  sh.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return; drag.on = true; drag.c.classList.add('drag'); }
    e.preventDefault();
    const over = [...nav.querySelectorAll('button[data-id]')].find(o => { if (o === drag.c) return false; const r = o.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 3 && e.clientY <= r.bottom + 3; });
    if (!over) return;
    const r = over.getBoundingClientRect();
    nav.insertBefore(drag.c, e.clientX > r.left + r.width / 2 ? over.nextSibling : over);
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.on) { dragged = true; drag.c.classList.remove('drag'); keepOrder(); setTimeout(() => { dragged = false; }); }
    drag = null;
  };
  sh.addEventListener('pointerup', endDrag); sh.addEventListener('pointercancel', endDrag);
  nav.addEventListener('click', e => {
    const c = editing && e.target.closest('button[data-id]'); if (!c) return;
    e.stopPropagation();
    if (dragged) return;
    const id = c.dataset.id, show = editing.hidden.has(id);
    if (show) editing.hidden.delete(id); else editing.hidden.add(id);
    c.setAttribute('aria-pressed', String(show));
  });
  nav.addEventListener('keydown', e => {
    if (!editing) return;
    const c = e.target.closest?.('button[data-id]');
    if (e.key === 'Escape') { e.preventDefault(); finishEditing(); return; }
    if (c && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      if (e.key === 'ArrowLeft' && c.previousElementSibling) nav.insertBefore(c, c.previousElementSibling);
      else if (e.key === 'ArrowRight' && c.nextElementSibling) nav.insertBefore(c.nextElementSibling, c);
      keepOrder(); c.focus();
    }
  });
  sh.addEventListener('click', e => {
    // The whole card opens the article; Cmd/Ctrl/Shift-click on the headline still opens the site.
    // The card that was pressed, also when the list moved under the pointer before the release (the click then goes to
    // the list around both cards).
    const card = e.target.closest('main li[data-key]') || (pressed?.isConnected && main.contains(e.target) ? pressed : null);
    if (card && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      const it = byKey.get(card.dataset.key);
      if (it) { e.preventDefault(); openArticle(it); }
      return;
    }
    // Cmd/Ctrl/Shift-click on the headline: the site as published, in a new tab or window.
    const head = e.target.closest('a.h');
    if (head) { const url = head.href; head.href = onSiteUrl(url); setTimeout(() => { head.href = url; }); }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'close-reader') closeArticle();
    else if (b.dataset.act === 'prev') step(-1);
    else if (b.dataset.act === 'next') step(1);
    else if (b.dataset.act === 'sections') { if (editing) finishEditing(); else startEditing(); }
    else if (b.dataset.act === 'sort') { sortMode = sortMode === 'importance' ? 'site' : 'importance'; gm.set('plainSort', sortMode); plainHost.scrollTop = 0; render(); }
    else if (b.dataset.act === 'show-read') { showReadNow = true; render(); }
    else if (b.dataset.act === 'later') toggleSaved('later', current);
    else if (b.dataset.act === 'mark') toggleSaved('marks', current);
    else if (b.dataset.act === 'hide-read') {
      // Turned on here, it also takes out what was read on this visit: that was asked for.
      hideRead = !(hideRead && !showReadNow); showReadNow = false; gm.set('plainHideRead', hideRead);
      if (hideRead) for (const k of readKeys) readBefore.add(k);
      render();
    }
    else if (b.dataset.act === 'original') { try { sessionStorage.setItem('declickbait-original', host); } catch {} location.reload(); }
  });
  // The card next to `from` on screen in direction dx/dy: ↑ ↓ the nearest card in the row above or
  // below (closest to the same column), ← → the neighbour in the same row. At the end of a row, and in
  // a single column, ← → stay put: they never move the mark up or down (j/k go through the list in order).
  function nearby(list, from, dx, dy) {
    const r = from.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    let best = null, score = Infinity;
    for (const li of list) {
      if (li === from) continue;
      const q = li.getBoundingClientRect(), qx = (q.left + q.right) / 2, qy = (q.top + q.bottom) / 2;
      if (dy && !(dy > 0 ? q.top >= r.bottom - 2 : q.bottom <= r.top + 2)) continue;
      if (dx && !(dx > 0 ? q.left >= r.right - 2 : q.right <= r.left + 2)) continue;
      if (dx && (q.bottom <= r.top || q.top >= r.bottom)) continue; // same row only
      const d = dy ? Math.abs(qy - cy) * 4 + Math.abs(qx - cx) : Math.abs(qx - cx) * 4 + Math.abs(qy - cy);
      if (d < score) { score = d; best = li; }
    }
    return best;
  }
  // Keyboard: the arrow keys move between the cards as they lie on screen, j/k in list order,
  // Enter (on the focused headline) or o opens; while reading, →/j and ←/k go to the next and
  // previous article and Esc closes.
  // On the window, before the page: an older copy of the engine still listening on the document then lets it be.
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || editing) return;
    const t = e.composedPath()[0];
    if (t && (/^(?:INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    const k = e.key;
    // The headline the key comes from: the event's own target, which Safari gives right where shadowRoot.activeElement
    // is empty; else the one that has the focus.
    const here = t?.closest?.('li[data-key]') || focused()?.closest?.('li[data-key]');
    if (current) {
      if (k === 'Escape') closeArticle();
      else if (k === 'ArrowRight' || k === 'j') step(1);
      else if (k === 'ArrowLeft' || k === 'k') step(-1);
      else if (k === 'l' || k === 'b') toggleSaved(k === 'l' ? 'later' : 'marks', current);
      else return;
    } else if (/^(?:Arrow(?:Down|Up|Left|Right)|j|k)$/.test(k)) {
      const list = cards(), cur = cursor() || (list.includes(here) ? here : undefined);
      let next;
      if (!cur) { const top = sh.querySelector('header').getBoundingClientRect().bottom; next = list.find(li => li.getBoundingClientRect().top >= top) || list[0]; }
      else if (k === 'j' || k === 'k') next = list[list.indexOf(cur) + (k === 'j' ? 1 : -1)];
      else next = nearby(list, cur, k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0, k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0);
      if (!next) return;
      focusCard(next); prefetch(next.dataset.key, true);
    } else if (k === 'o' || (k === 'Enter' && cursor() && !t?.closest?.('button, input, [data-act]'))) {
      const li = cursor() || (cards().includes(here) ? here : null); if (!li) return;
      openArticle(byKey.get(li.dataset.key));
    } else if (k === 'l' || k === 'b') {
      const li = cursor() || (cards().includes(here) ? here : null); if (!li) return;
      toggleSaved(k === 'l' ? 'later' : 'marks', byKey.get(li.dataset.key));
    } else return;
    e.preventDefault();
  }, true);

  render();
  timeMark('list');
  // A copy of the list for the next visit: gm-shim.js shows it before the page has even loaded, until this list is up
  // again (see there). Kept in the site's own localStorage, which is read at once, where extension storage keeps it
  // waiting in Safari. Only the extension has gm-shim.js. It takes over the copy's scrolling.
  const lastShot = document.getElementById('nothis-shot');
  if (lastShot) { plainHost.scrollTop = lastShot.scrollTop; lastShot.remove(); }
  if (EXT && !mix) {
    const shotKey = 'nothis-shot:' + location.pathname;
    let shotTimer = null;
    // At most every 1.5 s: the list changes all the time while it fills in.
    const saveShot = () => { shotTimer ||= setTimeout(() => { shotTimer = null; try {
      const html = `<style>${PLAIN_CSS}</style>` + sh.querySelector('.wrap').outerHTML;
      if (html.length < 400000) localStorage.setItem(shotKey, JSON.stringify({ at: Date.now(), html, title: listTitle }));
    } catch {} }, 1500); };
    new MutationObserver(saveShot).observe(main, { childList: true, subtree: true, characterData: true });
    saveShot();
  }
  // New articles from the feed or further down the front page rebuild the list, which waits while it is in use: until
  // a moment after the last touch, click, scroll or key, and while an article is open.
  let later = null, quietAt = 0;
  const renderSoon = (ms = 600) => { clearTimeout(later); later = setTimeout(() => (pressed || current || Date.now() < quietAt) ? renderSoon(500) : render(), ms); };
  if (mix) {
    // My news: each site's articles come in as its front page has been read; the list is built again each time.
    CFG.maxFetchesPerPage = 240;
    mix.load(fresh => { items.push(...fresh); fresh.forEach(add); renderSoon(0); }, text => { mixNote.textContent = text; mixNote.hidden = !text; });
    return true;
  }
  feedItems(src).then(feed => { if (!feed.length) return; feed.forEach(add); renderSoon(0); });
  // Read the rest of a lazily filled front page, a few articles at a time, then drop the site's body.
  // Each step makes the site load more (pictures, players, ads), work that holds up a tap, so it
  // waits while an article is open and for a moment after each touch, click, scroll or key.
  const busy = () => { quietAt = Date.now() + 2500; };
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) plainHost.addEventListener(ev, busy, { capture: true, passive: true });
  window.addEventListener('keydown', busy, { capture: true, passive: true }); // in Safari the keys can come from outside the list
  const finish = () => { timeMark('harvest-done'); window.scrollTo(0, 0); document.documentElement.classList.add('cb-plain-done'); };
  const more = fresh => { items.push(...fresh); rankItems(items); fresh.forEach(add); renderSoon(); };
  if (stopped) finish(); // a downloaded copy: all there is, and nothing to scroll
  else if (toLinks > 400) {
    // Next time this page is stopped before its scripts run (gm-shim.js), and read from a downloaded copy.
    try { localStorage.setItem('nothis-heavy', String(Date.now())); } catch {}
    // A heavy page (laying it out and one pass over its links took over 0.4 s; nytimes.com in Safari: 1.5 s) is not scrolled:
    // while it stays laid out under the list, Safari lays the whole page out again each time its scripts change it, and
    // the list froze for seconds at a time. It leaves the layout at once and is read once more, unmeasured, when its
    // HTML is all in.
    finish();
    const rest = () => { const fresh = frontPageItems(known, false); fresh.forEach(it => known.set(it.key, it)); if (fresh.length) more(fresh); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rest, { once: true }); else rest();
  } else harvest(known, fresh => more(fresh), undefined, () => !!current || Date.now() < quietAt).then(finish);
  return true;
}
