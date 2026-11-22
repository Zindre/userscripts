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
// The site's own menu (Pitchfork: News, Reviews, Best New Music …) and each section's own row of filters (Reviews:
// Best New Albums, Best New Reissues, 8.0+ reviews, Sunday Reviews, Tracks). Plain view lists articles only, so without
// these the site's other pages are out of reach; they open as plain view too. Links to the same site that are not
// articles, from menus outside the footer and from rows of tabs or switches; never account, subscription, sales,
// settings, game, contact or legal pages. { top, groups } — groups: a section's path → its filters. null: fewer than three.
const MENU_SKIP = /\b(?:account|profile|log ?in|log ?out|sign ?(?:in|out|up)|register|subscri\w*|abonn\w*|newsletters?|nyhetsbrev|privacy|personvern|cookies?|contact|kontakt|about|om oss|rss|advertis\w*|annonse\w*|faq|help|hjelp|masthead|jobs?|careers?|terms|vilkår|shop|butikk|search|søk|tips?|events?|kjøp|kjop|buy|tilbud|offers?|deals?|innstillinger|settings|preferences?|edition|kundeservice|customer|bedrift\w*|e-?avis|e-?paper|games?|spill|quiz|kryssord|crosswords?|black (?:week|friday)|plus|pluss|premium)\b|annonse|anzeige|sponsor|[+!*]$/i;
const TAB_LINKS = 'a[href][role="switch"], a[href][role="tab"], [role="tablist"] a[href]';
const menuPath = u => u.pathname.replace(/\/$/, '');
function menuLinks(els, base) {
  const out = new Map();
  for (const a of els) {
    let u; try { u = new URL(a.getAttribute('href'), base); } catch { continue; }
    const path = menuPath(u), t = norm(a.textContent);
    if (!/^https?:$/.test(u.protocol) || registrable(u.hostname) !== registrable(host) || !path || out.has(path)) continue;
    if (t.length < 2 || t.length > 32 || MENU_SKIP.test(t) || MENU_SKIP.test(path.replace(/[/_-]/g, ' '))) continue;
    if (site ? site.article.test(u.pathname) : genericArticlePath(u.pathname)) continue;
    out.set(path, { href: u.origin + u.pathname, path, text: t });
    if (out.size >= 16) break;
  }
  return out;
}
// A page's filters, without the ones already in the main menu. Its section: the menu item among them (Pitchfork's
// "Albums" is Reviews' own page), else the one given (the section whose page this is), else the menu item this page is.
function menuGroup(root, base, top, parent) {
  const tabs = menuLinks(root.querySelectorAll(TAB_LINKS), base);
  parent = [...tabs.keys()].find(p => top.has(p)) || parent;
  const links = [...tabs.values()].filter(l => !top.has(l.path));
  return parent && links.length >= 2 ? [parent, links] : null;
}
function siteMenu(root = document) {
  const navs = [...root.querySelectorAll('nav a[href], [role="navigation"] a[href]')].filter(a => !a.closest('footer, [role="contentinfo"]') && !a.matches(TAB_LINKS));
  const top = menuLinks(navs, location.href), here = menuPath(location);
  if (top.size < 3) return null;
  const g = menuGroup(root, location.href, top, top.has(here) ? here : null);
  return { top: [...top.values()], groups: new Map(g ? [g] : []) };
}
// The genre a card is filed under, as a link to the site's page for it (Pitchfork: "Rock" → /genre/rock). Looked for in
// the teaser's own card: the nearest box around the link that has one, as long as it holds no more than one teaser's links.
// When a card says it was published, from a <time> in the teaser's own card (Pitchfork: "November 19, 2026"). 0: unknown.
function dateOf(a) {
  // In the address (WordPress: /2026/02/27/the-inward-circles-shadow-reflex/), when the card shows none.
  const fromUrl = () => { const m = (a.getAttribute('href') || '').match(/\/(20\d\d|19\d\d)\/([01]\d)\/([0-3]\d)\//); return m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T12:00`) || 0 : 0; };
  for (let el = a.parentElement, i = 0; el && i < 6; el = el.parentElement, i++) {
    const t = el.querySelector('time'); if (!t) continue;
    if (el.querySelectorAll('a[href]').length > 6) return fromUrl();
    return Date.parse(t.getAttribute('datetime') || norm(t.textContent)) || fromUrl();
  }
  return fromUrl();
}
const GENRE_LINK = 'a[href*="/genre/" i], a[href*="/genres/" i], a[href*="/sjanger/" i]';
function genreOf(a) {
  for (let el = a.parentElement, i = 0; el && i < 6; el = el.parentElement, i++) {
    const g = el.querySelector(GENRE_LINK); if (!g) continue;
    const t = norm(g.textContent);
    return el.querySelectorAll('a[href]').length <= 6 && t.length >= 2 && t.length <= 30 ? t : '';
  }
  return '';
}
// A review's score (Pitchfork), kept in the page's data rather than on its card: path → "7.1", and Best New Music.
const ratings = new Map(), ratingsRead = new WeakSet();
function ratingFrom(fields, track) {
  const score = fields.match(/"score":(\d+(?:\.\d+)?)/);
  const best = /"isBestNewMusic":true/.test(fields) ? (track ? 'Best New Track' : 'Best New Music') : /"isBestNewReissue":true/.test(fields) ? 'Best New Reissue' : '';
  return score || best ? { score: score ? (+score[1]).toFixed(1) : '', best } : null;
}
// ── An album review's album, in the reader's music app ──
// The review's "Artist: Album" is looked up in the app chosen in the popup (CFG.albumApp), and the ▶ button opens it
// there. On a phone the link to the service's site opens its app when it is installed.
//   ytm: YouTube Music, the album's own playlist from its first song (it plays at once).
//   apple: Apple Music, the album's page (Apple's public search; its own links open the Music app).
//   spotify: Spotify's search for it (Spotify has no lookup without an account).
//   kaset: Kaset, the YouTube Music app for the Mac. The album's songs, in order, go to the Kaset Album helper
//     (extension/kaset-album) as kasetalbum://play?v=ID,ID,…, which has Kaset replace its queue with them and play; Kaset's
//     own links can only start one song.
const ALBUM_APPS = { ytm: 'YouTube Music', apple: 'Apple Music', spotify: 'Spotify', kaset: 'Kaset' };
const albumAppOn = () => !!ALBUM_APPS[CFG.albumApp];
const ALBUM_REVIEW = /\/reviews\/albums\//;
const findAll = (o, key, out = []) => {
  if (Array.isArray(o)) for (const v of o) findAll(v, key, out);
  else if (o && typeof o === 'object') for (const k in o) { if (k === key) out.push(o[k]); findAll(o[k], key, out); }
  return out;
};
// A YouTube Music page's own data: the page carries it as JavaScript strings (initialData.push({ …, data: '…' })).
// Read from the page as anyone opens it; YouTube Music's search service turns away requests from an extension.
async function ytmData(path) {
  // ucbcb=1: the page itself rather than YouTube's cookie question (which YouTube adds by itself on its way there), so
  // nothing is consented to on the reader's behalf.
  const r = await gm.rawXhr({ url: 'https://music.youtube.com' + path + (path.includes('?') ? '&' : '?') + 'cbrd=1&ucbcb=1', headers: { Accept: 'text/html' } });
  const out = [];
  for (const m of (r.responseText || '').matchAll(/initialData\.push\(\{path: '[^']*', params: JSON\.parse\('(?:[^'\\]|\\.)*'\), data: '((?:[^'\\]|\\.)*)'\}\)/g)) try {
    out.push(JSON.parse(m[1].replace(/\\(?:x([0-9a-f]{2})|(.))/gi, (_, hex, c) => hex ? String.fromCharCode(parseInt(hex, 16)) : c)));
  } catch {}
  return out;
}
const lowWords = s => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function albumParts(name) {
  const at = name.indexOf(': '), artist = at > 0 ? name.slice(0, at) : '', album = at > 0 ? name.slice(at + 2) : name;
  // "Rubber Soul (Super Deluxe)": the album's own name, its first words, is what has to match, with the artist.
  return { artist, album, core: lowWords(album.replace(/\s*[([].*$/, '')).split(' ').slice(0, 3).join(' ') };
}
// The album on YouTube Music: { playlist: its own playlist (OLAK5uy_…), songs: its songs' video ids, in order }.
async function ytmAlbum(name) {
  const { artist, album, core } = albumParts(name);
  const found = await ytmData('/search?q=' + encodeURIComponent(`${artist} ${album}`.trim()));
  // The album itself (the top result's card, or a row that leads to the album), before a song from it: the title
  // song's own row leads to its single (Baby Osamaa's "On Tha Run": one song).
  const album1 = id => /^MPRE/.test(id || '') ? id : '';
  const hits = [...findAll(found, 'musicCardShelfRenderer').map(it => ({ own: album1(findAll([it.title, it.onTap], 'browseId')[0]), parts: [it.title, it.subtitle] })),
    ...findAll(found, 'musicResponsiveListItemRenderer').map(it => ({ own: album1(it.navigationEndpoint?.browseEndpoint?.browseId), parts: it.flexColumns }))]
    .map(h => ({ ...h, from: findAll(h.parts, 'browseId').find(id => /^MPRE/.test(id)), text: lowWords(findAll(h.parts, 'runs').flat().map(r => r.text).join(' ')) }))
    .filter(h => h.text.includes(core) && (!artist || h.text.includes(lowWords(artist))));
  const hit = hits.find(h => h.own) || hits.find(h => h.from);
  if (!hit) return null;
  const page = await ytmData('/browse/' + (hit.own || hit.from));
  const playlist = (findAll(page, 'urlCanonical').join(' ').match(/list=(OLAK5uy_[\w-]+)/) || [])[1] || '';
  // Its songs: the rows of its track list (a phone gets them without playlistItemData), each played in its playlist.
  const songs = [...findAll(page, 'playlistItemData').map(p => p.videoId),
    ...findAll(findAll(page, 'musicShelfRenderer'), 'watchEndpoint').filter(w => !playlist || w.playlistId === playlist).map(w => w.videoId)];
  return { playlist, songs: [...new Set(songs.filter(v => /^[\w-]{11}$/.test(v || '')))].slice(0, 200) };
}
// The album on Apple Music: its page (https://music.apple.com/…/album/…), in the reader's own country's store.
async function appleAlbum(name) {
  const { artist, album, core } = albumParts(name);
  const country = (navigator.language.match(/-([a-z]{2})$/i)?.[1] || 'us').toLowerCase();
  const r = await gm.rawXhr({ url: `https://itunes.apple.com/search?entity=album&limit=10&country=${country}&term=` + encodeURIComponent(`${artist} ${album}`.trim()) });
  const res = JSON.parse(r.responseText || '{}').results || [];
  const hit = res.find(x => lowWords(x.collectionName || '').includes(core) && (!artist || lowWords(x.artistName || '').includes(lowWords(artist)) || lowWords(artist).includes(lowWords(x.artistName || '-'))));
  return hit?.collectionViewUrl ? hit.collectionViewUrl.replace(/[?&]uo=\d+/, '') : '';
}
// ── Which album a review is about, on any music site ──
// Not per site: a review's address says it is one (review, anmeldelse, recensione, …), outside the sections for concerts,
// films, books, songs or news, and its headline names artist and album the way music sites do:
//   "Artist – Album" (Clash, musicOMH, DIY), "Artist – Album Review" (Angry Metal Guy), "… (Album Review)" (Folk Radio),
//   "Album review: Artist – Album" (Kerrang), "Artist: Album review – …" (The Guardian), "Artist – ‘Album’ review: …"
//   (NME), "Artist review, Album – …" (The Independent), "Artist, crítica de Album" (MondoSonoro), and, where the
//   review's own address says so, "Artist's ‘Album’ …" (Exclaim, HipHopDX).
// "Artist: Album", or '' when the headline doesn't name both.
// An album's own page under /albums/ or /alben/ counts too (laut.de: /Tieflader/Alben/Juenger-Des-Mammon-127776), and
// Plattentests' rezi.php.
const REVIEW_WORD = /review|recens|rezension|\brezi\b|anmeld|kritik|cr[ií]tica|critique|chroniqu|arvio|bespreking|\/alb(?:ums?|en)\//i;
const NOT_ALBUM_DIR = /\/(?:[\w-]*-)?(?:photos?|fotos?|bilder|bildeserie|galler(?:y|ies|i)|live|concerts?|konserte?r?|koncerte?r?|konzerte?|conciertos?|gigs?|festivals?|films?|movies?|cine|cinema|tv|series|serier|books?|bøker|boker|games?|spill|theat\w*|teater|restaurants?|gear|tech|tracks?|songs?|singles?|news|nyheter|nyheder|nieuws|nachrichten|noticias|notizie|uutiset)(?:-[\w-]*)?\//i;
const NOT_ALBUM_SLUG = /(?:^|-)(?:live-review|concerts?|konsert|koncert|konzert|concierto|gig|festival|film|movie|book|game|song-review|track-review|single)(?:-|$)/i;
// 1: the address of a review (that isn't of a concert, film, …), -1: of something else, 0: neither.
function reviewUrl(url) {
  let path; try { path = decodeURIComponent(new URL(url, location.href).pathname); } catch { return 0; }
  const segs = path.split('/').filter(Boolean), slug = segs.pop() || '', dirs = '/' + segs.join('/') + '/';
  if (NOT_ALBUM_DIR.test(dirs) || NOT_ALBUM_SLUG.test(slug)) return -1;
  return REVIEW_WORD.test(path) ? 1 : 0;
}
const ALBUM_LABEL = /^(?:(?:album|ep|lp|cd|record|plate|skive|disco|disque|levy)[\s-]*)?(?:review|anmeldelse|plateanmeldelse|recension|recensione|recensie|rezension|kritik|cr[ií]tica|critique|arvio|levyarvio)\s*[:|–—-]\s+/i;
const OTHER_LABEL = /^[\p{L} ]{1,24}(?:review|anmeldelse|recension|recensione|rezension|kritik|cr[ií]tica|critique|arvio)\s*:/iu; // "Live review:", "Film review:"
// A monthly column, a concert on a date (The Jazz Mann: "…, Worcester, 12/11/2026"), an edition rather than an album.
const NOT_ALBUM_TEXT = /\b(?:reviewed|round-?up|column|best of|for (?:january|february|march|april|may|june|july|august|september|october|november|december))\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b|^\d+(?:st|nd|rd|th) anniversary/i;
// The site's name or address, or a note that this is a review, after the headline: "… - Loud And Quiet",
// "… - Die Review zum neuen Album bei metal.de", "… – jenesaispop.com".
const REVIEW_NOTE = /^(?:(?:die|the|our|unsere?|ausführliche|full|album|ep|lp)\s+)*(?:review|rezension|kritik|anmeldelse|recensione|critique|cr[ií]tica)\b|^[\w.-]+\.[a-z]{2,6}$/i;
const siteTail = s => { const n = lowWords(s); return !!n && (n === lowWords(pageMeta.site || '') || n === lowWords(host) || n === lowWords(host.replace(/\.[a-z]+$/, ''))); };
const NOT_ARTIST = /\b(?:best|albums?|reviews?|week|month|year|new|top|playlist|songs|tracks|interview|premiere|watch|listen|stream)\b|[?!@]/i;
function albumFromTitle(raw, loose) {
  let t = norm(unentity(raw || '')).replace(/\s+[|»•]\s+.*$/, ''), m, artist = '', album = '', reviewed = false;
  for (let tail; (tail = t.match(/^(.+)\s+[-–—]\s+([^-–—]+)$/)) && (REVIEW_NOTE.test(tail[2]) || siteTail(tail[2]));) t = tail[1];
  if (ALBUM_LABEL.test(t)) t = t.replace(ALBUM_LABEL, '');
  else if (OTHER_LABEL.test(t) || /^(?:mp3|video|watch|listen|premiere|stream|song|track|single|news|interview)\s*:/i.test(t)) return ''; // "MP3: Kanye West – “Runaway”
  if ((m = t.match(/^(.{1,60}?)\s*::?\s*([„“"«‘][^”"»’“]{1,120}[”"»’“])(?:\s|$)/)) || // Rolling Stone (DE): "Abba :: „The Visitors“ – …"
    (m = t.match(/^(.{1,60}?),?\s+(?:review|anmeldelse|recension|rezension)\s*,\s+(.{1,120}?)(?:\s+[–—:-]\s+.*)?$/i)) ||
    (m = t.match(/^(.{1,60}?),\s+(?:cr[ií]tica de|critique de|recensione di|review of|anmeldelse av|kritik av|rezension zu)\s+(.{1,120})$/i))) [, artist, album] = m;
  else {
    const said = t;
    t = t.replace(/\s*[(\[](?:album |ep |lp )?(?:review|recensione|rezension|anmeldelse|kritik|crítica|critique)[)\]]\s*$/i, '')
      .replace(/\s+(?:(?:album|ep|lp|record)\s+)?(?:review|recensione|rezension|anmeldelse|crítica|critique|recension)\b(?:\s*[:–—,-].*)?$/i, '');
    reviewed = t !== said; // "Artist: Album review – …": the colon is the artist's only with the word, or on a review's own address
    t = t.replace(/\s*[-–(\[]?\s*(?:[★☆✩✭⭐½]+|\d+(?:[.,]\d)?\s*\/\s*(?:10|5|100)|terningkast\s*\d)\s*[)\]]?\s*$/i, '');
    if ((m = t.match(/^(.+?)\s+[–—-]\s+(.+)$/))) { [, artist, album] = m; const c = artist.lastIndexOf(': '); if (c > 0) artist = artist.slice(c + 2); }
    else if ((reviewed || loose) && (m = t.match(/^(.+?):\s+(.+)$/))) {
      [, artist, album] = m;
      const by = album.match(/^(.{1,80}?)\s+by\s+(.{1,60})$/); // "Worlds Apart: Noon by Richard Skelton" (The Quietus)
      if (by) [, album, artist] = by;
      else {
        const own = artist.match(/^(.{1,40}?)['’]s\s+(.+)$/); // "Taylor Swift's Showgirl: The Encore Review"
        if (own) { artist = own[1]; album = own[2] + ': ' + album; }
        // Without the word, only a short "Artist: Album" (Pitchfork), not a headline ("Rachel Chinouriri: An Indie-Pop …").
        else if (!reviewed && (album.split(' ').length > 6 || artist.split(' ').length > 5)) return '';
      }
    }
    else if (loose && (m = t.match(/^([^/]{1,60}) \/ ([^/]{1,100})$/))) [, artist, album] = m; // "2hollis / Pirouette"
    else if (loose && (m = t.match(/^(.{1,50}?)['’]s?\s+(?:(?:new|debut|latest|sophomore|second|third)\s+)?(?:(?:album|LP|EP|record)\s+)?[‘'"“«]([^’'"”»]{1,100})[’'"”»]/i))) [, artist, album] = m;
    else return '';
  }
  const q = album.match(/^([‘'"“«„])(.{1,120})([’'"”»“])(?:\s+(?:EP|LP|album))?$/i);
  const QUOTES = { '‘': '’', "'": "'", '"': '"', '“': '”', '«': '»', '„': '“' };
  if (q && QUOTES[q[1]] === q[3]) album = q[2];
  else { const lead = album.match(/^([‘"“«„])([^’"”»“]{1,120})([’"”»“])/); if (lead && QUOTES[lead[1]] === lead[3]) album = lead[2]; } // "“Light Eater” – Chemnitz"
  // Taken from a list of reviews alone, not the review's own address: a plain "Artist – Album", not a sentence with a
  // dash in it (Rolling Stone's news among its reviews: "„Kevin – Allein zu Haus“-Sequel mit …").
  const open = s => /[„“«‘"]/.test(s) && !/[”»’"“]$/.test(s.trim()) && !/[„“«‘"].*[”»’"“]/.test(s);
  if (!loose && !reviewed && (/\s[–—-]\s/.test(album) || album.split(' ').length > 8 || open(artist) || open(album))) return '';
  artist = norm(artist); album = norm(album).replace(/[.,;:]$/, '');
  if (!artist || !album || artist.length > 60 || artist.split(' ').length > 7 || album.length > 120 || album.split(' ').length > 14 || NOT_ARTIST.test(artist) || NOT_ALBUM_TEXT.test(album)) return '';
  return `${artist}: ${album}`;
}
// A list's article: its album, from its card's two headings (headingPair), its headline, or (also) the headline on its
// own page (The Line of Best Fit's cards: "2hollis sides with romance on …"; its page: "2hollis – Pirouette review: …"),
// on its own review's address or in a list of reviews (Folk Radio's reviews link to its sister site, without the word
// in their addresses). Kept on it.
let listReviews = null;
function albumOf(it, also) {
  if (it.album) return it.album;
  listReviews ??= reviewUrl(location.href) > 0 || REVIEW_SECTION.test(location.pathname);
  const own = reviewUrl(it.url);
  if (!(own > 0 || (own === 0 && listReviews))) return '';
  const tried = it.albumTried ||= new Set();
  for (const t of [it.teaser, also]) if (t && !tried.has(t)) { tried.add(t); if ((it.album = albumFromTitle(t, own > 0))) break; }
  return it.album || '';
}
// A review opened directly: the album from the page's headline, when its address (or its JSON-LD) says it is a review.
function pageAlbum() {
  const own = reviewUrl(location.href);
  if (own < 0) return '';
  if (!own && ![...document.querySelectorAll('script[type="application/ld+json"]')].some(s => /"@type"\s*:\s*\[?\s*"(?:Review|ReviewNewsArticle)"/.test(s.textContent))) return '';
  // The review's own headline, not a logo in an h1 above it (Blabbermouth).
  const h1s = [...document.querySelectorAll('article h1, main h1, h1')].slice(0, 4).map(h => h.textContent);
  for (const t of [document.querySelector('meta[property="og:title"]')?.getAttribute('content'), ...h1s, document.title]) {
    const a = albumFromTitle(t, true); if (a) return a;
  }
  return '';
}
// Where the ▶ button goes: a URL, or '' when the album is not found.
const albumLinks = new Map();
function albumLink(name) {
  const app = CFG.albumApp, key = app + '\n' + name;
  if (!albumLinks.has(key)) albumLinks.set(key, (async () => {
    if (app === 'spotify') { const { artist, album } = albumParts(name); return 'https://open.spotify.com/search/' + encodeURIComponent(`${artist} ${album}`.trim()); }
    if (app === 'apple') return await appleAlbum(name);
    const a = await ytmAlbum(name);
    if (app === 'kaset') return a?.songs.length ? 'kasetalbum://play?v=' + a.songs.join(',') : '';
    if (!a?.playlist) return '';
    return 'https://music.youtube.com/' + (a.songs[0] ? `watch?v=${a.songs[0]}&list=` : 'playlist?list=') + a.playlist;
  })().catch(() => ''));
  return albumLinks.get(key);
}
function albumButton(name) {
  const b = document.createElement('button'), label = '▶ ' + ALBUM_APPS[CFG.albumApp];
  b.type = 'button'; b.className = 'kaset'; b.textContent = label; b.title = b.ariaLabel = T.playAlbumIn.replace('%s', ALBUM_APPS[CFG.albumApp]);
  b.addEventListener('click', async e => {
    e.preventDefault(); e.stopPropagation();
    // With a mouse, the service's site opens in a tab of its own, opened now (a tab opened after the lookup is blocked as
    // a pop-up). On a phone the page itself goes there, which is what has the service's app take it over.
    const tab = CFG.albumApp !== 'kaset' && matchMedia('(hover: hover) and (pointer: fine)').matches ? window.open('about:blank', '_blank') : null;
    b.textContent = '…'; b.disabled = true;
    const url = await albumLink(name);
    b.disabled = false; b.textContent = url ? label : T.kasetNone;
    if (tab) { if (url) tab.location.href = url; else tab.close(); }
    else if (url) location.href = url;
  });
  return b;
}
const ratingText = r => [r.score, r.best].filter(Boolean).join(' · ');
function readRatings(root) {
  for (const s of root.querySelectorAll('script:not([src])')) {
    if (ratingsRead.has(s)) continue;
    ratingsRead.add(s);
    readRatingsIn(s.textContent);
  }
}
// From the page's text itself: an older page of a list (moreForFilters) is read this way, then parsed without its scripts.
function readRatingsIn(t) {
  if (!t.includes('"ratingValue"')) return;
  for (const m of t.matchAll(/"ratingValue":\{([^{}]*)\},"url":"([^"]{1,300})"/g)) try {
    const r = ratingFrom(m[1], /"channelType":"Tracks"/.test(m[1])), path = menuPath(new URL(JSON.parse(`"${m[2]}"`), location.origin));
    if (r) ratings.set(path, r);
    // The rest of the review's entry: who wrote it, when, and its summary (the card's own line from the site, where
    // the review page's description only says "Read … review of the album").
    const start = t.lastIndexOf('{"id":"', m.index), o = start >= 0 && m.index - start < 30000 ? t.slice(start, m.index) : '';
    const str = re => { const x = o.match(re); try { return x ? JSON.parse(`"${x[1]}"`) : ''; } catch { return ''; } };
    const ai = o.indexOf('"author":{"items":['), authors = ai < 0 ? '' : o.slice(ai, o.indexOf('}]}', ai) >>> 0); // not a photographer's
    const by = [...authors.matchAll(/"name":"((?:[^"\\]|\\.){1,80})"/g)].map(x => { try { return JSON.parse(`"${x[1]}"`); } catch { return ''; } }).filter(Boolean).slice(0, 3);
    reviewInfo.set(path, { by, artist: norm(str(/"subHed":\{"name":"((?:[^"\\]|\\.)*)"/)), dek: plainText(str(/"dangerousDek":"((?:[^"\\]|\\.)*)"/)), at: Date.parse(str(/"pubDate":"([^"]*)"/)) || 0 });
  } catch {}
}
// HTML as plain text, without parsing a document for it: "<em>Echo</em>", "R&amp;B".
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const plainText = html => norm(String(html).replace(/<[^>]*>/g, '').replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (m, d, x, n) => d ? String.fromCodePoint(+d) : x ? String.fromCodePoint(parseInt(x, 16)) : ENTITIES[n.toLowerCase()] ?? m));
const reviewInfo = new Map(), reviewOf = url => { try { return reviewInfo.get(menuPath(new URL(url))) || null; } catch { return null; } };
const ratingOf = url => { if (!ratings.size) return null; try { return ratings.get(menuPath(new URL(url))) || null; } catch { return null; } };
let pageName = ''; // the site's name for the page plain view lists, when not its front page (plainView)
const sectionLabel = id => id === 'latest' ? T.latest : id === 'other' ? pageName || T.other : id === 'saved-later' ? T.later : id === 'saved-marks' ? T.marks : sectionNames.get(id) || (id[0].toUpperCase() + id.slice(1)).replace(/-/g, ' ');
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
    // From every list of sizes on offer (a lazy-loading site keeps the real ones in data-srcset until the picture is in
    // view, and shows an 80-pixel one meanwhile: NRK), the smallest that is still sharp at full width on a phone.
    const sets = [img.dataset.srcset, img.getAttribute('srcset'), ...[...(img.closest('picture')?.querySelectorAll('source') || [])].flatMap(s => [s.dataset.srcset, s.getAttribute('srcset')])];
    const sizes = sets.filter(Boolean).flatMap(set => set.split(/,\s+(?=\S)/).map(c => c.trim().split(/\s+/))).filter(c => c[0] && /^\d+w$/.test(c[1] || '')).map(c => [c[0], parseInt(c[1])]);
    const fit = sizes.filter(c => c[1] >= 800).sort((a, b) => a[1] - b[1])[0] || sizes.sort((a, b) => b[1] - a[1])[0];
    const src = (fit && fit[1] > 200 ? fit[0] : '') || img.currentSrc || img.src || img.dataset.src || (img.getAttribute('srcset') || img.dataset.srcset || '').trim().split(/\s+/)[0];
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

// A card that heads a review with the artist and the album as two headings, each a link to the review (Headphone
// Commute: "The Inward Circles" / "Shadow Reflex"): both, as "Artist – Album", and the album for the ▶ button when the
// card or the page is filed under reviews or albums. null: not such a card.
const REVIEWS_PATH = /review|album|\beps?\b|plate|disque|schallplatte/i;
function headingPair(a, url) {
  const card = a.closest('article, li'); if (!card || card.querySelectorAll('a[href]').length > 8) return null;
  const same = h => [...h.querySelectorAll('a[href]')].some(l => { try { return new URL(l.getAttribute('href'), location.href).href === url; } catch { return false; } });
  const hs = [...card.querySelectorAll('h1, h2, h3, h4, h5')].filter(h => same(h) && textOf(h)).slice(0, 3);
  if (hs.length !== 2) return null;
  const [artist, album] = hs.map(textOf);
  const filed = [...card.querySelectorAll('a[href]')].some(l => !same(l) && !l.closest('h1, h2, h3, h4, h5') && REVIEWS_PATH.test(l.getAttribute('href'))) || REVIEWS_PATH.test(location.pathname);
  return { teaser: `${artist} – ${album}`, album: filed ? `${artist}: ${album}` : '' };
}

// known: articles already collected, skipped without measuring (harvest() calls this repeatedly).
// measure false: without prominence(), which needs the page laid out (the heavy-page path at the end of plainView); the
// headline's level stands in for its size. root: a downloaded copy of the page instead (plainView, a stopped heavy page).
const LEVEL_SIZE = { H1: 40, H2: 32, H3: 26, H4: 22 };
function frontPageItems(known, measure = true, root = document) {
  const items = new Map();
  readRatings(root);
  for (const a of root.querySelectorAll('a[href]')) {
    if (skipLink(a)) continue;
    const url = isArticleLink(a); if (!url) continue;
    const key = articleKey(url);
    if (known?.has(key) || isAd(a) || AD_SECTION.test(sectionOf(url))) continue;
    const el = headlineEl(a), rv = reviewOf(url), named = el ? textOf(el) : '';
    // A review headed by the album alone (Pitchfork's "An Exchange of Information"): its artist first, as on its page.
    const pair = el && el.closest('h1, h2, h3, h4, h5') ? headingPair(a, url) : null;
    const teaser = pair ? pair.teaser : named && rv?.artist && !named.toLowerCase().includes(rv.artist.toLowerCase()) ? `${rv.artist}: ${named}` : named;
    const it = items.get(key);
    const m = el && measure ? prominence(a, el) : { fs: (el && LEVEL_SIZE[el.tagName]) || 0, area: 0, y: Infinity };
    if (it) { if (pair) { it.teaser = teaser; it.album ||= pair.album; } it.teaser ||= teaser; it.paid ||= isPaid(a); it.genre ||= genreOf(a); it.date ||= dateOf(a); it.img ||= teaserImage(a); if (m.fs * Math.sqrt(m.area) > it.m.fs * Math.sqrt(it.m.area)) it.m = { ...m, y: Math.min(m.y, it.m.y) }; }
    else items.set(key, { url, key, teaser, paid: isPaid(a), rating: ratingOf(url), genre: genreOf(a), date: dateOf(a) || rv?.at || 0, by: rv?.by, dek: rv?.dek, album: pair?.album || '', section: sectionOf(url), img: teaserImage(a), m });
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
      return { url, key: articleKey(url), teaser: text(get('title')?.textContent), desc: text((get('description') || get('summary'))?.textContent), img: /^https?:/.test(feedImg || '') ? feedImg : '', section: 'latest' };
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
  // A list that goes on in pages (a next-page link) and loads them as the reader nears its end (Headphone Commute, with
  // Infinite Scroll): past the page's own end there are only older pages, so scrolling stops there. It loaded 25 pages.
  const paged = !!document.querySelector('link[rel="next"], a[rel="next"], .nav-previous a, .pagination a.next, a.next.page-numbers');
  let rest = 250, passes = 0, spent = 0, end = 0;
  for (let i = 0, idle = 0; i < 40 && idle < 6 && !done(); i++) {
    while (hold()) await new Promise(r => setTimeout(r, 400));
    if (document.readyState === 'loading') {
      await new Promise(r => { document.addEventListener('readystatechange', r, { once: true }); setTimeout(r, 3000); });
      i--; continue;
    }
    end ||= document.documentElement.scrollHeight;
    if (paged && scrollY + innerHeight >= end - 2) break;
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
  .top [data-act="menu"]{display:inline-flex;align-items:center;padding:5px 7px}
  .top [data-act="menu"][hidden]{display:none}
  .top [data-act="menu"] svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
  .top [data-act="menu"][aria-expanded="true"]{background:var(--fg);border-color:var(--fg);color:var(--bg)}
  h1:has(.page){display:flex;align-items:center;gap:10px}
  h1 .page{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:17px;font-weight:600;color:var(--muted)}
  @media (max-width: 480px){h1:has(.page){display:block} h1 .page{display:none}}
  .site-menu{padding:10px 0 2px;font-size:15px}
  .site-menu .row,.site-menu .sub{display:flex;flex-wrap:wrap;gap:2px 16px}
  .site-menu .sub{gap:2px 14px;margin-top:6px;padding-top:6px;border-top:1px solid var(--line);font-size:14px}
  .site-menu .sub span{color:var(--muted);padding:3px 0}
  .site-menu[hidden]{display:none}
  .site-menu a{color:var(--fg);text-decoration:none;padding:3px 0}
  .site-menu a:hover{text-decoration:underline}
  .site-menu a[aria-current="page"]{color:var(--accent);font-weight:600}
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
  .refine[hidden],.refine [hidden]{display:none}
  .genres{display:flex;gap:6px;overflow-x:auto;padding-top:8px;scrollbar-width:none}
  .genres::-webkit-scrollbar{display:none}
  .refine button{white-space:nowrap;border-radius:999px;font-size:13px;padding:3px 10px}
  .refine button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--bg)}
  .range{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding-top:8px;font-size:13px;color:var(--muted)}
  .range input{font:inherit;color:var(--fg);background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:2px 6px;margin-left:4px}
  .refine.loading .range::after,.refine.loading .genres::after{content:'…';align-self:center;color:var(--muted);padding:0 4px}
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
  .view .bar button.save[aria-pressed="true"] .h{stroke:var(--bg)}
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
  .reader video{display:block;width:100%;height:auto;border-radius:6px;background:#000}
  .reader iframe{display:block;width:100%;height:600px;margin:0 0 1em;border:0;border-radius:6px;background:#fff}
  .reader figure.video>video,.reader figure.video>iframe,.reader figure.video>.play{margin:0 auto}
  .reader figure.video>iframe{height:auto;background:#000}
  .reader figure.video>video{max-height:78vh}
  .reader .play{position:relative;display:flex;align-items:center;justify-content:center;width:100%;padding:0;border:0;border-radius:6px;
    background:#222 center/cover no-repeat;color:#fff;overflow:hidden}
  .reader .play .icon{display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;
    background:rgba(0,0,0,.6);font-size:24px;padding-left:5px;box-sizing:border-box}
  .reader .play:hover .icon,.reader .play:focus-visible .icon{background:rgba(0,0,0,.8)}
  .reader .play .title{position:absolute;left:0;right:0;bottom:0;padding:28px 12px 10px;text-align:left;font-size:15px;font-weight:600;
    line-height:1.3;background:linear-gradient(transparent,rgba(0,0,0,.75))}
  .reader .term{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}
  .reader .term[aria-expanded="true"]{text-decoration-style:solid}
  .reader .explain{display:block;margin:8px 0 0;padding:8px 12px;font-size:15px;line-height:1.4;color:var(--muted);border-left:3px solid var(--line);background:color-mix(in srgb,var(--line) 35%,transparent);border-radius:0 6px 6px 0}
  .reader .explain[hidden]{display:none}
  .reader figcaption{font-size:14px;color:var(--muted);margin-top:4px}
  .reader .byline{font-size:14px;color:var(--muted);margin-bottom:14px}
  .reader .byline .rating{margin:0 8px 0 0;font-size:15px;padding:1px 7px}
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
  /* Larger pictures (a choice in the popup): the picture over the card, as wide as the card. */
  :host(.big-pics) li.pic{display:flex;flex-direction:column-reverse;gap:8px}
  /* The whole picture, in its own shape: cut to one shape, faces lost their tops. A very tall one stops at the screen's width. */
  :host(.big-pics) li.pic .pic-img{width:100%;height:auto;max-height:100vw;object-fit:contain;object-position:left top;background:none}
  :host(.big-pics) li.pic .pic-img:not([src]){display:none}
  /* A picture in the reader opens over the page when tapped; a tap there enlarges it, to be moved about with a finger. */
  .reader img{cursor:zoom-in}
  .zoom{position:fixed;inset:0;z-index:5;background:#000;overflow:auto;-webkit-overflow-scrolling:touch;display:flex}
  .zoom img{margin:auto;display:block;width:100%;height:auto;max-height:100%;object-fit:contain;cursor:zoom-in}
  .zoom.in{display:block}
  .zoom.in img{width:250%;max-width:none;max-height:none;cursor:zoom-out}
  .zoom button{position:fixed;top:calc(10px + env(safe-area-inset-top, 0px));right:12px;background:rgba(0,0,0,.6);color:#fff;border-color:rgba(255,255,255,.4);font-size:15px;padding:6px 12px}
  li.pic{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:12px;align-items:start}
  /* The picture is part of the card: a click on it goes to the card. In Safari on a Mac, a click on a picture could start
     dragging it instead, and then nothing opened. */
  li.pic .pic-img{width:120px;height:80px;border-radius:6px;object-fit:cover;object-position:center 25%;background:var(--line);display:block;pointer-events:none;-webkit-user-drag:none;user-select:none}
  @media (max-width: 480px){li.pic{grid-template-columns:minmax(0,1fr) 84px;gap:10px} li.pic .pic-img{width:84px;height:56px}}
  .rating{display:inline-block;margin-left:6px;padding:0 6px;border-radius:4px;font-size:13px;font-weight:700;background:var(--fg);color:var(--bg);vertical-align:2px;white-space:nowrap}
  .rating.best{background:var(--accent)}
  li .meta{font-size:13px;color:var(--muted);margin-top:2px}
  .reader .facts{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:14px;margin:-6px 0 16px;color:var(--fg)}
  .reader .facts span{color:var(--muted);margin-right:5px}
  button.kaset{margin-left:6px;padding:0 7px;font-size:12px;line-height:1.5;border-radius:4px;vertical-align:2px;white-space:nowrap}
  .reader .byline button.kaset{margin-left:10px;font-size:13px}
  .genre{display:inline-block;margin-left:6px;padding:0 6px;border:1px solid var(--line);border-radius:4px;font-size:12px;color:var(--muted);vertical-align:2px;white-space:nowrap}
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
  .all-read{padding:48px 0;text-align:center;color:var(--muted)}
  .all-read p{margin:0 0 12px;font-size:18px;color:var(--fg)}
  .edit-hint,.mix-note{margin:6px 0 0;font-size:13px;color:var(--muted)}
  h2 a.site-link{color:inherit;text-decoration:none}
  h2 a.site-link:hover{color:var(--accent)}
  nav button[data-id]{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
  nav button[data-id] small{color:var(--muted);font-size:12px;margin-left:4px}
  nav button[data-id][aria-pressed="false"]{opacity:.45;text-decoration:line-through;border-style:dashed}
  nav button[data-id].drag{outline:2px solid var(--accent);outline-offset:1px;opacity:1}`;


let plainHost = null, plainCount = 0;
// A picture from the reader, over the whole page: first as large as fits, a tap enlarges it two and a half times around
// the place tapped (scroll or drag to move), another tap brings it back. Close, Esc or Back takes it away.
function zoomImage(im) {
  const root = im.getRootNode(), box = document.createElement('div'), big = document.createElement('img'), x = document.createElement('button');
  box.className = 'zoom'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', im.alt || T.close);
  big.src = im.currentSrc || im.src; big.alt = im.alt;
  x.textContent = '✕ ' + T.close;
  const close = () => { box.remove(); removeEventListener('keydown', key, true); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  big.addEventListener('click', e => {
    const r = big.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (box.classList.toggle('in')) { box.scrollLeft = fx * box.scrollWidth - box.clientWidth / 2; box.scrollTop = fy * box.scrollHeight - box.clientHeight / 2; }
  });
  x.addEventListener('click', e => { e.stopPropagation(); close(); });
  addEventListener('keydown', key, true);
  box.append(big, x); root.append(box); x.focus({ preventScroll: true });
}
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
  // They keep their height too (the size they had when last drawn): with none, the page was all "bottom", and a site
  // that loads more as the reader nears the end (Headphone Commute) loaded page after page of its archive, unseen.
  st.textContent = 'html.cb-plain{overflow:hidden!important} html.cb-plain>body *{visibility:hidden!important;pointer-events:none!important} html.cb-plain.cb-plain-done>body>*{content-visibility:hidden!important;contain-intrinsic-size:auto 1px auto 3000px!important}';
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
// A video in the reader, which never starts by itself.
// - A file: the browser's own player, still until play is pressed; nothing but its picture is fetched before that. A stream
//   the browser cannot play (HLS outside Safari) shows its picture only.
// - A player's frame (YouTube, NRK …): its picture and title with a play button; nothing of the player loads until pressed,
//   and then it plays in its place.
// Upright videos keep their shape, no taller than most of the screen.
function readerVideoBox(b) {
  const el = readerEl, f = el('figure', '', 'video'), label = b.caption || b.title || '';
  const [rw, rh] = (b.ratio || '').split('/').map(Number), upright = rw > 0 && rh > rw;
  const shape = x => { if (!(rw > 0 && rh > 0)) return; x.style.aspectRatio = `${rw}/${rh}`; if (upright) x.style.width = `min(100%, calc(78vh * ${rw / rh}))`; };
  const still = () => {
    if (!b.poster) return f.remove();
    const im = el('img'); im.src = b.poster; im.alt = label; im.loading = 'lazy'; im.addEventListener('error', () => f.remove()); f.prepend(im);
  };
  if (b.src) {
    const v = el('video');
    if (/\.m3u8(?:[?#]|$)/i.test(b.src) && !v.canPlayType('application/vnd.apple.mpegurl')) still();
    else {
      v.controls = true; v.preload = 'none'; v.playsInline = true; v.setAttribute('playsinline', '');
      if (b.poster) v.poster = b.poster;
      v.src = b.src; shape(v); if (label) v.setAttribute('aria-label', label);
      v.addEventListener('error', () => { v.remove(); still(); }, { once: true });
      f.append(v);
    }
  } else {
    const play = el('button', '', 'play');
    play.type = 'button'; play.setAttribute('aria-label', label ? `${T.playVideo}: ${label}` : T.playVideo);
    if (b.poster) play.style.backgroundImage = `url("${b.poster.replace(/["\\]/g, encodeURIComponent)}")`;
    if (!(rw > 0)) play.style.aspectRatio = '16/9'; shape(play);
    play.append(el('span', '▶', 'icon'));
    if (b.title) play.append(el('span', b.title, 'title'));
    // NRK: the clip's stream, looked up now (a few lines from NRK, not the video), so a tap starts it in Safari's own
    // player while the tap still counts as yours. Without it, or where the browser can't play the stream, NRK's player.
    let stream = '';
    // NRK's new pages give no picture for the clip: NRK's own, from the clip's details.
    if (b.nrk && !b.poster)
      fetch(`https://psapi.nrk.no/playback/metadata/clip/${encodeURIComponent(b.nrk)}`).then(r => r.ok ? r.json() : null).then(j => {
        const im = (j?.preplay?.poster?.images || []).filter(x => /^https:\/\//.test(x.url || '') && x.pixelWidth <= 1280).sort((x, y) => y.pixelWidth - x.pixelWidth)[0];
        if (!im || b.poster) return;
        b.poster = im.url; play.style.backgroundImage = `url("${im.url.replace(/["\\]/g, encodeURIComponent)}")`;
      }).catch(() => {});
    const hls = !!el('video').canPlayType('application/vnd.apple.mpegurl'), json = u => fetch(u).then(r => r.ok ? r.json() : null);
    // Schibsted (VG): the video's file, from their video service by its id.
    const found = b.svp ? json(`https://svp.vg.no/svp/api/v1/${encodeURIComponent(b.svp.provider)}/assets/${encodeURIComponent(b.svp.id)}?appName=webdetox`).then(j => {
      const u = j?.assetType === 'video' && j.status === 'active' && (j.streamUrls?.mp4 || (hls && j.streamUrls?.hls));
      return /^https:\/\//.test(u || '') ? u : '';
    }) : b.nrk && hls ? json(`https://psapi.nrk.no/playback/manifest/clip/${encodeURIComponent(b.nrk)}`).then(j => {
      const a = j?.playability === 'playable' && (j.playable?.assets || []).find(x => x.format === 'HLS' && !x.encrypted && /^https:\/\//.test(x.url || ''));
      return a ? a.url : '';
    }) : null;
    found?.then(u => { stream = u; }).catch(() => {});
    const start = u => {
      const v = el('video');
      v.controls = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
      if (b.poster) v.poster = b.poster;
      v.src = u; shape(v); if (label) v.setAttribute('aria-label', label);
      play.replaceWith(v); v.play().catch(() => {});
    };
    play.addEventListener('click', () => {
      if (stream) return start(stream);
      if (!b.embed) { found?.then(u => { if (u && play.isConnected) start(u); }).catch(() => {}); return; }
      const fr = el('iframe');
      fr.src = b.embed; fr.title = label || T.playVideo; fr.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media'; fr.allowFullscreen = true;
      fr.style.cssText = play.style.cssText; fr.style.backgroundImage = '';
      play.replaceWith(fr); fr.focus();
    });
    f.append(play);
  }
  if (b.caption) f.append(el('figcaption', b.caption));
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
  // Which site the article is from, first in the line under the headline: its name on its own site, else its address
  // (an article from another site, in My news or among the saved ones).
  let from = ''; try { from = new URL(art?.finalUrl || url, location.href).hostname.replace(/^www\./, ''); } catch {}
  if (from === host && pageMeta.site) from = pageMeta.site;
  const by = [from, art?.byline, art?.date && new Date(art.date).toLocaleString(T.lang === 'en' ? undefined : T.lang, { dateStyle: 'medium', timeStyle: 'short' })].filter(x => x && x !== 'Invalid Date').join(' · ');
  // A review's score, from the list or from the review's own page.
  const rating = art?.rating || ratingOf(url);
  if (by || rating) {
    const line = el('div', by, 'byline');
    if (rating) line.prepend(el('span', ratingText(rating), 'rating' + (rating.best ? ' best' : '')));
    const album = art?.album || (/: /.test(title) ? title : '');
    if (albumAppOn() && album && (ALBUM_REVIEW.test(url) || art?.albumPair)) line.append(albumButton(album));
    out.push(line);
  }
  // A review's facts from its page: genre, record label, the year the music came out.
  const facts = [[T.genre, art?.facts?.genre], [T.recordLabel, art?.facts?.label], [T.released, art?.facts?.year]].filter(f => f[1]);
  if (facts.length) {
    const box = el('div', '', 'facts');
    for (const [k, v] of facts) { const f = el('div'); f.append(el('span', k), v); box.append(f); }
    out.push(box);
  }
  for (const b of art?.blocks || []) {
    if (b.t === 'p') out.push(b.terms ? readerTermsP(b) : el('p', b.text));
    else if (b.t === 'h') out.push(el('h3', b.text));
    else if (b.t === 'quote') out.push(el('blockquote', b.text));
    else if (b.t === 'list') { const l = el(b.ordered ? 'ol' : 'ul'); for (const t of b.items) l.append(el('li', t)); out.push(l); }
    else if (b.t === 'img') {
      const f = el('figure'), im = el('img');
      im.src = b.src; im.alt = b.caption || ''; im.loading = 'lazy'; im.decoding = 'async';
      im.addEventListener('error', () => f.remove());
      im.addEventListener('click', () => zoomImage(im));
      f.append(im); if (b.caption) f.append(el('figcaption', b.caption)); out.push(f);
    }
    else if (b.t === 'video') out.push(readerVideoBox(b));
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
  if (!/article/i.test(document.querySelector('meta[property="og:type"]')?.getAttribute('content') || '') && !/"@type"\s*:\s*\[?\s*"(?:\w*Article|Review)"/.test(ld)) return false; // Pitchfork's reviews: a Review
  const url = location.href.split('#')[0], h1 = document.querySelector('h1');
  let title = norm(h1?.textContent) || document.title;
  // A review headed by the artist, with the album as the heading under it (Headphone Commute): both, and the album for
  // the ▶ button when the review is filed under reviews or albums.
  const h2 = h1?.nextElementSibling?.matches('h2') ? norm(h1.nextElementSibling.textContent) : '';
  const pairAlbum = h2 && h2.length <= 120 && title.length <= 80 ? `${title}: ${h2}` : '';
  if (pairAlbum) title = `${title} – ${h2}`;
  const filed = pairAlbum && ([...(h1.closest('header, article') || h1.parentElement).querySelectorAll('a[href]')].some(l => REVIEWS_PATH.test(l.getAttribute('href') || '')) || reviewUrl(location.href) > 0); // or its own address says so (Blabbermouth)
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
  if (filed && !art.albumPair) { art.album = pairAlbum; art.albumPair = true; }
  if (!art.albumPair && albumAppOn()) { const a = pageAlbum(); if (a) { art.album = a; art.albumPair = true; } }
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
  let logo = null, menu = null, items = [], toLinks = 0, giveBack = () => {}, known = new Map();
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
    try { menu = siteMenu(src); } catch {}
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
    <div class="wrap"><header><div class="top"><h1></h1><button data-act="menu" aria-expanded="false" aria-label="${T.siteMenu}" title="${T.siteMenu}" hidden><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><button data-act="sort"></button><button data-act="original">${T.original}</button></div><div class="site-menu" role="navigation" aria-label="${T.siteMenu}" hidden></div><div class="filters"><button class="read-toggle" data-act="hide-read" role="switch"></button><nav aria-label="${T.sections}"></nav><button class="edit-secs" data-act="sections" aria-label="${T.editSections}" title="${T.editSections}">✎</button></div><div class="refine" hidden><div class="genres" role="group" aria-label="${T.genre}"></div><div class="range"><label>${T.dateFrom} <input type="date" data-f="from"></label><label>${T.dateTo} <input type="date" data-f="to"></label><button data-f="score" aria-pressed="false">${T.byScore}</button></div></div><p class="edit-hint" hidden>${T.editHint}</p><p class="mix-note" hidden></p></header>
    <main></main><footer></footer><div class="keys"></div></div>
    <div class="hold" hidden role="menu"></div>
    <div class="view" hidden role="dialog" aria-modal="true" tabindex="-1"><div class="bar"><div><span></span><button class="save" data-act="later" aria-pressed="false" aria-label="${T.later}" title="${T.later} (L)"><svg aria-hidden="true" viewBox="0 0 24 24"><circle class="f" cx="12" cy="12" r="9"/><path class="h" d="M12 7v5l3 2"/></svg></button><button class="save" data-act="mark" aria-pressed="false" aria-label="${T.mark}" title="${T.mark} (B)"><svg aria-hidden="true" viewBox="0 0 24 24"><path class="f" d="M6 3h12v18l-6-4.5L6 21z"/></svg></button><button data-act="prev" aria-label="${T.prev}">‹</button><button data-act="next" aria-label="${T.next}">›</button><button data-act="close-reader"></button></div></div><article class="reader"></article></div>`;
  const h1 = sh.querySelector('h1'), mixNote = sh.querySelector('.mix-note');
  if (logo) {
    const chip = document.createElement('span'), name = document.createElement('span');
    chip.className = 'logo'; chip.style.background = logo.bg; chip.append(logo.el);
    name.className = 'sr'; name.textContent = pageMeta.site || host;
    h1.append(chip, name);
  } else h1.textContent = mix ? T.myNews : pageMeta.site || host;
  if (mix) sh.querySelector('[data-act="original"]').hidden = true;
  // The site's menu, behind a button: the front page first when this is another page of the site (Best New Music), then
  // each section's filters on a line of their own. Those of the other sections are fetched the first time it opens (and
  // kept for three days), since the front page doesn't have them: Pitchfork's 8.0+ reviews are on its reviews page.
  const siteMenuEl = sh.querySelector('.site-menu'), menuBtn = sh.querySelector('[data-act="menu"]');
  let fillSubMenus = () => {};
  if (menu) {
    const here = menuPath(location), top = new Map(menu.top.map(m => [m.path, m]));
    const link = m => { const a = document.createElement('a'); a.href = m.href; a.textContent = m.text; if (m.path === here) a.setAttribute('aria-current', 'page'); return a; };
    const row = document.createElement('div'); row.className = 'row';
    if (here) row.append(link({ href: location.origin + '/', path: '', text: pageMeta.site || host }));
    row.append(...menu.top.map(link));
    siteMenuEl.append(row);
    const shown = new Map();
    const showGroup = (parent, links) => {
      if (shown.has(parent) || !top.has(parent)) return;
      const div = document.createElement('div'), name = document.createElement('span');
      div.className = 'sub'; name.textContent = top.get(parent).text; div.append(name, ...links.map(link));
      shown.set(parent, div);
      // In the main menu's order.
      const after = menu.top.map(m => m.path).filter(p => shown.has(p));
      const next = after[after.indexOf(parent) + 1];
      siteMenuEl.insertBefore(div, next ? shown.get(next) : null);
    };
    for (const [p, links] of menu.groups) showGroup(p, links);
    const KEY = 'siteMenuGroups', fresh = 3 * 864e5;
    gm.get(KEY, {}).then(all => { for (const [p, links] of Object.entries(all?.[host]?.groups || {})) showGroup(p, links); });
    let fetched = false;
    fillSubMenus = async () => {
      if (fetched || !CFG.fetch) return; fetched = true;
      const all = (await gm.get(KEY, {})) || {}, mine = all[host];
      if (mine && Date.now() - mine.t < fresh) return;
      const groups = {};
      await Promise.all(menu.top.filter(m => m.path !== here).slice(0, 8).map(async m => {
        try {
          const r = await gm.xhr({ url: m.href, headers: { Accept: 'text/html' } });
          const g = r.status < 400 && menuGroup(parseHtml(r.responseText), r.finalUrl || m.href, top, m.path);
          if (g && !menu.groups.has(g[0])) { groups[g[0]] = g[1]; showGroup(...g); }
        } catch {}
      }));
      for (const [p, links] of menu.groups) groups[p] = links;
      const kept = Object.entries({ ...all, [host]: { t: Date.now(), groups } }).sort((a, b) => b[1].t - a[1].t).slice(0, 60);
      gm.set(KEY, Object.fromEntries(kept));
    };
    menuBtn.hidden = false;
    // On one of those pages, its name next to the site's: "Pitchfork  8.0+ reviews".
    const cur = here && (top.get(here) || [...menu.groups.values()].flat().find(m => m.path === here));
    if (cur) { const pg = document.createElement('span'); pg.className = 'page'; pg.textContent = cur.text; h1.append(pg); }
    // Its articles whose address names no section (WordPress: /2026/02/27/…) are this page's own: named after it.
    if (cur) pageName = cur.text;
  }
  sh.querySelector('.keys').textContent = T.keys;
  if (startup.plainBigPics) plainHost.classList.add('big-pics');
  document.documentElement.appendChild(plainHost); ownColors();
  onlyList();
  document.getElementById('nothis-cover')?.remove();
  // Remember the site, so next time the extension covers it before the original is drawn.
  if (!mix) gm.get('plainHosts', []).then(hs => gm.set('plainHosts', [host, ...(hs || []).filter(h => h !== host)].slice(0, 300)));

  const sections = new Map(), byKey = new Map();
  // Narrowing a list of reviews (Pitchfork): by genre, when most cards name one (several can be on at once), by when they
  // were published, and the highest score first. Kept for an hour on the site, so it holds while moving on to another of
  // its lists (8.0+ reviews, Best New Albums).
  const refineEl = sh.querySelector('.refine'), genresEl = refineEl.querySelector('.genres');
  const fromEl = refineEl.querySelector('[data-f="from"]'), toEl = refineEl.querySelector('[data-f="to"]'), scoreEl = refineEl.querySelector('[data-f="score"]');
  let picked = new Set(), shown = new Set(), from = 0, to = 0, byScore = false;
  const day = v => v ? Date.parse(v + 'T00:00') || 0 : 0;
  const readRange = () => { from = day(fromEl.value); to = day(toEl.value) && day(toEl.value) + 864e5; };
  gm.get('plainRefine', {}).then(all => {
    const r = all?.[host]; if (!r || Date.now() - r.t > 36e5) return;
    picked = new Set(r.g || []); fromEl.value = r.from || ''; toEl.value = r.to || ''; byScore = !!r.score; readRange();
    renderSoon(0); setTimeout(moreForFilters, 1500); // once the list is up
  });
  const saveRefine = () => gm.get('plainRefine', {}).then(all => gm.set('plainRefine', { ...Object.fromEntries(Object.entries(all || {}).filter(([, r]) => Date.now() - r.t < 36e5)), [host]: { g: [...picked], from: fromEl.value, to: toEl.value, score: byScore, t: Date.now() } }));
  const offFilters = it => (shown.size && !shown.has(it.genre)) || (from && !(it.date >= from)) || (to && !(it.date < to));
  const rated = it => parseFloat(it.rating?.score) || (it.rating ? 0 : -1);
  const scoreFirst = (a, b) => rated(b) - rated(a);
  function showRefine() {
    const all = [...byKey.values()].filter(it => !isSaved(it.section)), n = new Map();
    for (const it of all) if (it.genre) n.set(it.genre, (n.get(it.genre) || 0) + 1);
    const most = k => all.filter(k).length >= all.length * 0.4;
    const genres = n.size >= 2 && most(it => it.genre), scores = most(it => it.rating), dates = (genres || scores) && most(it => it.date);
    refineEl.hidden = !(genres || scores) || !!editing;
    shown = genres && !refineEl.hidden ? new Set([...picked].filter(g => n.has(g))) : new Set();
    genresEl.hidden = !genres; refineEl.querySelector('.range').hidden = !dates;
    if (!dates) from = to = 0; else readRange();
    scoreEl.hidden = !scores; if (!scores) byScore = false;
    scoreEl.setAttribute('aria-pressed', String(byScore));
    if (refineEl.hidden) return;
    const chip = (g, text, on) => { const b = document.createElement('button'); b.dataset.genre = g; b.textContent = text; b.setAttribute('aria-pressed', String(on)); return b; };
    genresEl.replaceChildren(chip('', T.allGenres, !shown.size), ...[...n.keys()].sort((a, b) => a.localeCompare(b)).map(g => chip(g, g, shown.has(g))));
  }
  // Few left after narrowing: the site's older pages of the same list, followed by its rel="next" link (Pitchfork:
  // ?page=2, 30 reviews a page), until there are 20, or with a start date until they go back past it; 20 more pages at most.
  const nextOf = (doc, base) => { try { const u = new URL(doc.querySelector('link[rel="next"]')?.getAttribute('href'), base); return u.origin === location.origin ? u.href : ''; } catch { return ''; } };
  let nextPage = mix ? '' : nextOf(src, location.href), paging = false;
  // A review open, or a finger or button held on a card (both declared further down, in place once the list is up).
  const inUse = () => { try { return !!(current || pressed); } catch { return false; } };
  async function moreForFilters() {
    if (paging || !nextPage || !CFG.fetch || !(shown.size || from || to)) return;
    paging = true; refineEl.classList.add('loading');
    // The page stays usable meanwhile: a pause between pages (Safari parses a 2 MB page for a good while), none fetched
    // while a review is open or a button held, and the page parsed without its scripts once its data is read.
    for (let n = 0; n < (from ? 20 : 8) && nextPage && (shown.size || from || to); n++) {
      if (n) await new Promise(r => setTimeout(r, 600));
      while (inUse()) await new Promise(r => setTimeout(r, 500));
      const list = [...byKey.values()], oldest = Math.min(...list.map(it => it.date || Infinity));
      // The list runs newest first: once past the start date, older pages can only be outside it.
      if (from ? oldest < from : list.filter(it => !offFilters(it)).length >= 20) break;
      try {
        const url = nextPage, r = await gm.xhr({ url, headers: { Accept: 'text/html' } });
        if (r.status >= 400) break;
        readRatingsIn(r.responseText);
        const doc = parseHtml(r.responseText);
        nextPage = nextOf(doc, url);
        const fresh = frontPageItems(known, false, doc);
        fresh.forEach(it => known.set(it.key, it));
        if (fresh.length) more(fresh);
      } catch { break; }
    }
    paging = false; refineEl.classList.remove('loading');
  }
  const refined = () => { saveRefine(); render(); plainHost.scrollTop = 0; moreForFilters(); };
  genresEl.addEventListener('click', e => {
    const b = e.target.closest('button[data-genre]'); if (!b) return;
    const g = b.dataset.genre;
    if (!g) picked.clear(); else if (shown.has(g)) picked.delete(g); else picked.add(g);
    refined();
  });
  for (const el of [fromEl, toEl]) el.addEventListener('change', () => { readRange(); refined(); });
  scoreEl.addEventListener('click', () => { byScore = !byScore; refined(); });
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
    st[kind] = [...(on ? [entry] : []), ...(st[kind] || []).filter(s => s.key !== entry.key)].slice(0, 2000);
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
  // Large pictures: a front page that offers its picture only small (CNN) gets the article's own share picture instead,
  // once the article has been looked up, when the small one turns out narrower than a phone screen in pixels.
  const sharpen = (im, m) => {
    if (!im || !startup.plainBigPics || im.dataset.sharp || !m || m.err || !m.image || m.image === im.getAttribute('src')) return;
    const swap = () => { if (im.naturalWidth && im.naturalWidth < 600) { im.dataset.sharp = '1'; im.src = m.image; } };
    if (im.complete) swap(); else im.addEventListener('load', swap, { once: true });
  };
  function fill(it, li, fetched = false) {
    const m = cache[it.key];
    if (m && !m.err && mutedTopicOf(it.url, it.teaser, m)) { dropRow(it.key, li); return; }
    const found = m && !m.err ? cleanMeta(m, it.url) : it.desc ? { title: '', desc: it.desc } : null;
    // The site's own summary on its list (Pitchfork) says more than the review page's description.
    const meta = it.dek ? { ...(found || { title: '' }), desc: it.dek } : found;
    const { text, lead } = choose(it.teaser, meta);
    const a = li.querySelector('a.h'), p = li.querySelector('p.lead');
    a.textContent = text;
    if (norm(text) !== norm(it.teaser)) a.title = 'Original: ' + it.teaser;
    if (meta?.title && albumAppOn() && !li.querySelector('button.kaset')) {
      const album = albumOf(it, meta.title);
      if (album) a.parentElement.insertBefore(albumButton(album), a.parentElement.querySelector('div.meta, p.lead'));
    }
    const waiting = !lead && !m && !fetched && CFG.fetch;
    p.textContent = lead; p.hidden = !lead && !waiting; p.classList.toggle('wait', waiting);
    const im = li.querySelector('.pic-img');
    const src = im && (it.img || (m && !m.err && m.image) || '');
    if (src && im.getAttribute('src') !== src && !im.dataset.sharp) im.src = src;
    sharpen(im, m);
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
    const look = `${withSection ? 1 : 0}${it.paid ? 1 : 0}${it.rating ? 1 : 0}${it.genre ? 1 : 0}${it.by?.length ? 1 : 0}`, prev = oldRows?.get(it.key);
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
    // A review's score, as the site gives it: "8.4", and "Best New Music".
    if (it.rating) { const b = document.createElement('span'); b.className = 'rating' + (it.rating.best ? ' best' : ''); b.textContent = ratingText(it.rating); text.append(b); }
    // Its genre, as the site files it (Pitchfork: "Rock").
    if (it.genre) { const g = document.createElement('span'); g.className = 'genre'; g.textContent = it.genre; text.append(g); }
    const album = albumAppOn() && (albumOf(it) || (it.rating && ALBUM_REVIEW.test(it.url) && it.teaser));
    if (album) text.append(albumButton(album));
    // Who wrote a review, and when: "19 Nov 2026 · Olivier Lafontant".
    if (it.by?.length) {
      const day = it.date ? new Date(it.date).toLocaleDateString(T.lang === 'en' ? undefined : T.lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const d = document.createElement('div'); d.className = 'meta'; d.textContent = [day, it.by.join(', ')].filter(Boolean).join(' · '); text.append(d);
    }
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
    const album = albumAppOn() ? albumOf(it) : ''; // from its card's two headings, or its headline
    if (art && album && !art.albumPair) { art.album = album; art.albumPair = true; }
    reader.replaceChildren(...readerContent(art, li?.querySelector('a.h').textContent || it.teaser, lede, it.url));
  }
  function renderSection(id) {
    const ol = document.createElement('ol');
    for (const it of byScore ? [...sections.get(id)].sort(scoreFirst) : sections.get(id)) {
      if (rows.has(it.key)) continue; // an article in two sections is shown once
      if (offFilters(it) && !isSaved(id)) continue;
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
    showRefine();
    // Read articles in or out of the list, like unread-only mail.
    const readToggle = sh.querySelector('.read-toggle');
    readToggle.textContent = T.hideRead; readToggle.setAttribute('aria-checked', String(hideRead && !showReadNow));
    sh.querySelector('[data-act="sort"]').textContent = sortMode === 'importance' ? T.siteOrder : T.byImportance;
    if (sortMode === 'importance') {
      // One list across the visible sections, loudest on the front page first; feed-only items last.
      const ol = document.createElement('ol'), seenKeys = new Set();
      for (const id of order()) if (isSaved(id) && !layout.hidden.includes(id)) renderSection(id);
      const all = order().filter(id => !isSaved(id) && !layout.hidden.includes(id)).flatMap(id => sections.get(id))
        .filter(it => !seenKeys.has(it.key) && seenKeys.add(it.key) && !offFilters(it) && !(skipRead(it) && hiddenRead.add(it.key))).sort(byScore ? scoreFirst : (a, b) => (b.score || 0) - (a.score || 0));
      for (const it of all) if (!rows.has(it.key)) { const li = row(it, true); if (li) ol.append(li); }
      const sec = document.createElement('section'), h2 = document.createElement('h2');
      sec.id = 's-importance'; h2.textContent = T.byImportance;
      sec.append(h2, ol); main.append(sec);
    }
    else for (const id of order()) if (!layout.hidden.includes(id)) renderSection(id);
    groupSmall();
    // Everything read and hidden: say so, with the way to see it again, instead of an empty page.
    if (!rows.size && hiddenRead.size) {
      const box = document.createElement('div'), b = document.createElement('button');
      box.className = 'all-read'; b.dataset.act = 'show-read'; b.textContent = T.showAllRead;
      box.append(Object.assign(document.createElement('p'), { textContent: T.allRead }), b);
      main.append(box);
    }
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
    else if (b.dataset.act === 'menu') { const open = siteMenuEl.hidden; siteMenuEl.hidden = !open; b.setAttribute('aria-expanded', String(open)); if (open) fillSubMenus(); }
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
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || editing || sh.querySelector('.zoom')) return; // an enlarged picture has the keys
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
