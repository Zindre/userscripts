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
  ...['related', 'share', 'social', 'newsletter', 'advert', 'ad-slot', 'adslot', 'promo', 'recommend', 'comment', 'teaser', 'byline', 'breadcrumb', 'author', 'reels', 'listenerscore']
    // promo, but not Drupal's node-promoted: an article promoted to the front page (Clash's reviews).
    .map(c => c === 'promo' ? `[class*="promo" i]:not([class*="promoted" i])` : `[class*="${c}" i]`)].join(', ');
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

// A srcset's candidates, [{ u, w }], read the way the browser reads it: an address runs to the first space, so it may hold
// commas itself (NRK's new pages: "…?im=Crop,rect=((…));Resize,width=640 640w"), and a comma only ends a candidate after it.
function readerSrcset(set) {
  const out = [];
  for (let i = 0; i < set.length;) {
    while (i < set.length && /[\s,]/.test(set[i])) i++;
    let j = i; while (j < set.length && !/\s/.test(set[j])) j++;
    let u = set.slice(i, j), d = '';
    if (/,$/.test(u)) { u = u.replace(/,+$/, ''); i = j; }
    else { let k = set.indexOf(',', j); if (k < 0) k = set.length; d = set.slice(j, k); i = k + 1; }
    if (u) out.push({ u, w: parseFloat(d) || 0 });
  }
  return out;
}
function readerImage(img, base) {
  const src = img.getAttribute('src'), lazy = img.dataset.src || img.dataset.lazySrc || img.dataset.original;
  const set = img.getAttribute('srcset') || img.dataset.srcset || img.closest('picture')?.querySelector('source[srcset]')?.getAttribute('srcset') || '';
  // The largest candidate in a srcset ("a.jpg 320w, b.jpg 1024w"), else src.
  const best = readerSrcset(set).sort((a, b) => b.w - a.w)[0]?.u;
  for (const u of [best, lazy, src && !src.startsWith('data:') ? src : '']) {
    if (!u || /\.svg(?:[?#]|$)|placeholder|spacer|blank\.|1x1/i.test(u)) continue;
    const w = +img.getAttribute('width') || 0;
    if (w && w < 200) return '';
    try { const abs = new URL(u, base).href; if (/^https?:/.test(abs)) return abs; } catch {}
  }
  return '';
}
// A video in the story with a file of its own (NRK's "levende stillbilde": a short silent loop, in a small, a medium and a
// large copy): { src, poster }, the largest copy up to 1080 lines, so it plays sharp on a phone. '' when the video is only
// a player's script, which the reader does not run. The reader shows it still, with its controls: it plays when tapped.
function readerVideo(box, base) {
  const files = [];
  for (const v of box.tagName === 'VIDEO' ? [box] : box.querySelectorAll('video')) {
    for (const s of [v, ...v.querySelectorAll('source')]) {
      const u = s.getAttribute('src'), type = s.getAttribute('type') || '';
      if (!u || (type && !/mp4|webm|quicktime/i.test(type))) continue;
      try {
        const abs = new URL(u, base);
        if (abs.protocol !== 'https:' || /\.m3u8|\.mpd|^blob:/i.test(abs.href)) continue;
        const lines = +(abs.pathname.match(/[_-](\d{3,4})p?\.(?:mp4|webm|mov)$/i)?.[1] || 0);
        let poster = ''; try { poster = v.getAttribute('poster') ? new URL(v.getAttribute('poster'), base).href : ''; } catch {}
        files.push({ src: abs.href, poster: /^https:/.test(poster) ? poster : '', lines });
      } catch {}
    }
  }
  const fit = files.filter(f => f.lines <= 1080).sort((a, b) => b.lines - a.lines)[0] || files[0];
  return fit ? { src: fit.src, poster: fit.poster } : null;
}
// A video player's frame in the story (YouTube, Vimeo, NRK's own and the like), the way the site embeds it. The reader shows
// its picture and title and loads the frame only when tapped: { embed, poster }. Anything else in a frame stays out.
const PLAYER_FRAME = [
  [/^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/, id => ({ embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`, poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` })],
  [/^https:\/\/player\.vimeo\.com\/video\/(\d+)/, id => ({ embed: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1` })],
  [/^https:\/\/(?:www\.)?dailymotion\.com\/embed\/video\/(\w+)/, id => ({ embed: `https://www.dailymotion.com/embed/video/${id}?autoplay=1`, poster: `https://www.dailymotion.com/thumbnail/video/${id}` })],
  [/^https:\/\/static\.nrk\.no\/ludo\/[^#]*#id=([\w.-]+)/, id => ({ embed: `https://static.nrk.no/ludo/latest/video-embed.html#id=${id}` })],
  [/^https:\/\/(?:streamable\.com\/[eo]|cdn\.jwplayer\.com\/players|players\.brightcove\.net|embed\.ted\.com\/talks|www\.svtplay\.se\/video|play\.tv2\.no\/embed)\//, (m, src) => ({ embed: src })],
];
const PLAYER_BOX = 'figure[data-video-source], astro-island[component-url*="NrknoPlayer"], astro-island[component-url*="/Video."], nrkno-player[src^="nrk:"], lite-youtube, iframe, [data-videoid], [data-video-id], astro-island[props*="streamUrls"]';
const LEAD_VIDEO = PLAYER_BOX + ', video';
// What tells two videos apart: the file, the player's frame, or the video's id in Schibsted's video service.
const readerVideoKey = v => v.src || v.embed || (v.svp ? `svp:${v.svp.provider}/${v.svp.id}` : '');
// The first player inside a box (a figure around Dinside's JW Player).
function readerPlayerIn(box, base) {
  for (const e of box.querySelectorAll(PLAYER_BOX)) { const v = e.tagName === 'IFRAME' ? readerPlayerFrame(e, base) : readerPlayer(e, base); if (v) return v; }
  return null;
}
function readerPlayerFrame(frame, base) {
  let src; try { src = new URL(frame.getAttribute('src') || frame.dataset.src || frame.dataset.lazySrc || '', base).href; } catch { return null; }
  for (const [re, make] of PLAYER_FRAME) { const m = src.match(re); if (m) return make(m[1], src); }
  return null;
}
// A video the page's script builds from data in the story, read from that data: { src | embed, poster, title, ratio }.
// - NRK's clips (<figure data-video-source="POTION">): NRK's own player for the clip. Its "PS" boxes are TV programmes
//   and channels beside the story, and stay out.
// - Schibsted's sites (VG, Aftenposten, BT, E24 …): the video's file in the player's data ("streamUrls"), a video only,
//   not a story read aloud ("assetType":"audio").
// - JW Player (Dagbladet, Dinside): its stream, by the video's id, unless the site marks the video as advertising.
// - <lite-youtube videoid> (WordPress): YouTube.
function readerPlayer(el, base) {
  const poster = () => { const img = el.querySelector('img'); return img ? readerImage(img, base) : ''; };
  if (el.tagName === 'FIGURE' && el.getAttribute('data-video-source') === 'POTION' && /^[\w-]{8,}$/.test(el.getAttribute('data-video-id') || ''))
    // Its data-aspect-ratio is the clip's on a phone; NRK's player shows every clip 16:9. nrk: the clip's id, for its
    // stream, which Safari plays itself (NRK's player in a frame shows only the picture on the iPhone).
    return { embed: `https://static.nrk.no/ludo/latest/video-embed.html#id=${el.getAttribute('data-video-id')}`, nrk: el.getAttribute('data-video-id'), poster: poster(), title: norm(el.getAttribute('data-title')) };
  // NRK's new pages (www.nrk.no/artikkel/…): the player is built in the browser from Astro's props (the clip's id, title and
  // caption, no picture: the reader looks that up with the stream), and is <nrkno-player src="nrk:{id}"> once built.
  if (el.tagName === 'ASTRO-ISLAND' && /NrknoPlayer/.test(el.getAttribute('component-url') || '')) {
    let p = {}; try { p = JSON.parse(el.getAttribute('props') || '{}'); } catch {}
    const val = x => Array.isArray(x) ? x[1] : undefined, id = val(p.id);
    if (typeof id !== 'string' || !/^[\w-]{8,}$/.test(id)) return null;
    const head = val(p.posterData), str = x => typeof x === 'string' ? norm(x) : '';
    return { embed: `https://static.nrk.no/ludo/latest/video-embed.html#id=${id}`, nrk: id, poster: '', title: str(head && val(head.heading)), caption: str(val(p.caption)) };
  }
  const nrk = el.tagName === 'NRKNO-PLAYER' && (el.getAttribute('src') || '').match(/^nrk:([\w-]{8,})$/)?.[1];
  if (nrk) {
    const ps = el.querySelector('nrkno-player-poster');
    const still = (ps && readerSrcset(ps.getAttribute('srcset') || '').filter(c => c.w <= 1280 && /^https:/.test(c.u)).sort((a, b) => b.w - a.w)[0]?.u) || poster();
    return { embed: `https://static.nrk.no/ludo/latest/video-embed.html#id=${nrk}`, nrk, poster: still, title: norm(ps?.getAttribute('heading') || '') };
  }
  if (el.tagName === 'LITE-YOUTUBE' && /^[\w-]{11}$/.test(el.getAttribute('videoid') || ''))
    return { ...PLAYER_FRAME[0][1](el.getAttribute('videoid')), title: norm(el.getAttribute('playlabel') || el.getAttribute('title')) };
  for (const a of el.attributes) {
    const v = a.value;
    if (v.length > 80 && v.includes('"streamUrls"')) {
      // Astro writes its props as [0, value]: "mp4":[0,"https://…"].
      const get = k => v.match(new RegExp(`"${k}":(?:\\[0,)?"([^"]+)"`))?.[1]?.replace(/\\u002F/g, '/') || '';
      if (get('assetType') !== 'video') return null;
      const src = get('mp4') || get('hls');
      if (!/^https:/.test(src)) return null;
      const still = (v.match(/"imageAsset":(?:\[0,)?\{[^{}]*?"main":(?:\[0,)?"(https:[^"]+)"/) || [])[1] || '';
      const ar = get('aspectRatio'), r = +ar > 0 ? `${ar}/1` : '';
      return { src, poster: still ? still + (still.includes('?') ? '' : '?t[]=1080q80') : poster(), title: get('title'), ratio: r };
    }
  }
  // Schibsted's newer pages (VG) give only the video's id, its picture and its shape: the file comes from their video
  // service by the id, when the reader shows it. The provider is in the picture's address (…/users/vgtv/images/…).
  if (el.tagName === 'ASTRO-ISLAND' && /\/Video\.[\w-]+\.js/.test(el.getAttribute('component-url') || '')) {
    let p = {}; try { p = JSON.parse(el.getAttribute('props') || '{}'); } catch {}
    const val = x => Array.isArray(x) ? x[1] : undefined, id = String(val(p.id) ?? '');
    const img = val(p.imageAsset) || {}, meta = val(p.metadata) || {}, main = val(img.main);
    const provider = typeof main === 'string' && main.match(/^https:\/\/images\.stream\.schibsted\.media\/users\/([\w-]+)\/images\//)?.[1];
    if (val(p.assetType) !== 'video' || !/^\d+$/.test(id) || !provider) return null;
    const ar = +val(meta.aspectRatio), title = val(meta.seoTitle);
    return { svp: { provider, id }, poster: main + '?t[]=1080q80', title: typeof title === 'string' ? norm(title) : '', ratio: ar > 0 ? `${ar}/1` : '' };
  }
  const jw = el.getAttribute('data-videoid') || el.getAttribute('data-video-id') || '';
  if (/^\w{8}$/.test(jw) && /cdn\.jwplayer\.com/.test(el.getAttribute('style') || el.innerHTML.slice(0, 2000))) {
    if (/^(?:1|true)$/.test(el.getAttribute('data-is-content-marketing') || '')) return null;
    return { src: `https://cdn.jwplayer.com/manifests/${jw}.m3u8`, poster: `https://cdn.jwplayer.com/v2/media/${jw}/poster.jpg?width=1280`, title: '' };
  }
  return null;
}

// The element that holds the most paragraph text: a paragraph counts fully for its parent, half for
// its grandparent, a third above that and so on for five levels, so a body whose paragraphs sit in
// separate wrappers (BBC: a nest of blocks per paragraph) still wins as a whole.
// The text can come in several boxes alike, with the reader score and an ad in between (Pitchfork's reviews: the opening
// two paragraphs in one, the rest in the next). The others of the same kind and class in the same article, in order.
// The article around it, not the root itself: when the text's element is the <article> (bt.no), there is nothing
// alike to look for, and looking inside it found nothing at all, so the story read as having no text.
function readerParts(root, skip) {
  const cls = root.getAttribute('class'), within = root.parentElement?.closest('article, main');
  if (!cls || !within) return [root];
  const same = [...within.getElementsByTagName(root.tagName)].filter(el => el === root || (el.getAttribute('class') === cls && !el.contains(root) && !root.contains(el) && !el.closest(skip)
    && [...el.querySelectorAll('p')].some(p => norm(p.textContent).length >= 40)));
  return same.length <= 6 ? same : [root];
}
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

// A review's score on its own page (Pitchfork's "musicRating"), else schema.org's reviewRating.
function pageRating(html, doc) {
  const m = html.match(/"musicRating":\{([^{}]*)\}/);
  if (m) return ratingFrom(m[1], /"isTrackReview":true/.test(html));
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) try {
    for (const it of [].concat(JSON.parse(s.textContent)['@graph'] || JSON.parse(s.textContent))) {
      const r = it?.reviewRating, v = r && parseFloat(r.ratingValue), best = r && parseFloat(r.bestRating);
      if (v >= 0) return { score: best && best !== 10 ? `${v}/${best}` : v.toFixed(1), best: '' };
    }
  } catch {}
  return null;
}
// A music review's facts on its page (Pitchfork: {"genre":"Folk/Country","label":"Rough Trade",…,"releaseYear":"2026"}).
function reviewFacts(html) {
  const m = html.match(/\{("genre":"[^{}]*"releaseYear":"[^"]*"[^{}]*)\}/);
  if (!m) return null;
  try { const f = JSON.parse(`{${m[1]}}`); return { genre: norm(f.genre), label: norm(f.label), year: norm(f.releaseYear) }; } catch { return null; }
}
// What a music review is about, as schema.org names it (Pitchfork: "Radie Peat: No Human Tongue Can Tell").
// The album or song a review is about, from the page's JSON-LD: { name: "Artist: Album" when the artist is given, album:
// true for a MusicAlbum (musicOMH, The Independent, DIY, The Line of Best Fit: the album as the review's item, or the
// album with the review inside it) }. null: none.
function reviewedAlbum(doc) {
  const artistOf = a => norm([].concat(a || []).map(x => typeof x === 'string' ? x : x?.name).filter(x => typeof x === 'string').join(', '));
  const named = (r, album) => ({ name: (artistOf(r.byArtist) ? artistOf(r.byArtist) + ': ' : '') + unentity(norm(r.name)), album, artist: !!artistOf(r.byArtist) });
  let found = null;
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) try {
    for (const it of [].concat(JSON.parse(s.textContent)['@graph'] || JSON.parse(s.textContent))) {
      const r = it?.itemReviewed, type = t => [].concat(t || []).join(' ');
      if (r && /\bMusic(?:Recording|Album)\b/.test(type(r['@type'])) && typeof r.name === 'string') return named(r, /MusicAlbum/.test(type(r['@type'])));
      if (!found && /\bMusicAlbum\b/.test(type(it?.['@type'])) && typeof it.name === 'string') found = named(it, true);
    }
  } catch {}
  return found;
}
function readArticle(html, url, withImages) {
  const doc = parseHtml(html), art = readArticleIn(doc, url, withImages);
  if (art) try { art.rating = pageRating(html, doc); const rv = reviewedAlbum(doc); art.album = rv?.name || ''; art.albumPair = !!(rv?.album && rv.artist); art.facts = reviewFacts(html); } catch {}
  return art;
}
// → { blocks: [{ t: 'p'|'h'|'quote'|'list'|'img'|'video'|'embed', text, items, src, poster, caption }], date, byline, paid, partial } or null
// partial: a paid article that arrived with only its start. short: an article with little text.
function readArticleIn(doc, url, withImages) {
  let paid = false, date = '', byline = '', article = /article/i.test(doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || '');
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      for (const it of [].concat(JSON.parse(s.textContent)['@graph'] || JSON.parse(s.textContent))) {
        if (!it || !/Article|NewsArticle|Report|^Review$/i.test(String(it['@type']))) continue;
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
  // A video once (NRK has the same clip in a small, a medium and a large copy, a site can repeat its player).
  const addVideo = v => { if (!blocks.some(b => b.t === 'video' && readerVideoKey(b) === readerVideoKey(v))) blocks.push({ t: 'video', ...v }); };
  const walk = el => {
    for (const c of el.children) {
      const tag = c.tagName;
      if (tag === 'IFRAME') {
        const src = readerEmbed(c, url), pf = !src && withImages && readerPlayerFrame(c, url);
        if (src) blocks.push({ t: 'embed', src }); else if (pf) addVideo({ ...pf, title: norm(c.getAttribute('title')) });
        continue;
      }
      if (c.matches(skip)) continue;
      const pv = withImages && (readerPlayer(c, url) || (tag === 'FIGURE' ? readerPlayerIn(c, url) : null));
      if (pv) { addVideo({ ...pv, caption: (f => f ? readerText(f) : '')(c.querySelector('figcaption')) || pv.caption || '' }); continue; }
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
      } else if (withImages && (tag === 'VIDEO' || (tag === 'FIGURE' && c.querySelector('video')))) {
        const v = readerVideo(c, url), cap = (f => f ? readerText(f) : '')(tag === 'FIGURE' ? c.querySelector('figcaption') : null);
        const img = !v?.poster && c.querySelector('img'), still = img ? readerImage(img, url) : '';
        if (v) addVideo({ src: v.src, poster: v.poster || still, caption: cap });
        else if (still) blocks.push({ t: 'img', src: still, caption: cap });
      } else if (tag === 'FIGURE' || tag === 'IMG' || tag === 'PICTURE') {
        const img = tag === 'IMG' ? c : c.querySelector('img');
        const src = withImages && img ? readerImage(img, url) : '';
        const cap = tag === 'FIGURE' ? c.querySelector('figcaption') : null;
        if (src) blocks.push({ t: 'img', src, caption: cap ? readerText(cap) : '' });
        // A person in the story with a thumbnail of a picture and a few words about them (VG: "Thomas Trones / Caught the
        // elk on camera"): the words, as a line of the story. "Name: what they say."
        else if (cap && img && +img.getAttribute('width') > 0 && +img.getAttribute('width') < 200) {
          const name = cap.firstElementChild?.matches('strong, b, h2, h3, h4, span') ? readerText(cap.firstElementChild) : '';
          const all = readerText(cap), rest = name && all.startsWith(name) ? norm(all.slice(name.length)) : '';
          const t = name && rest ? `${name}: ${rest}` : all;
          if (t.length >= 20) blocks.push({ t: 'p', text: t });
        }
      } else walk(c);
    }
  };
  if (entry) walk(entry); else if (feed) feed.forEach(walk);
  else {
    if (root) readerParts(root, skip).forEach(walk);
    // A quiz can sit beside the element with the text (Amedia puts the week's quiz above it): keep that order.
    const above = [];
    for (const f of quizzes) {
      const src = readerEmbed(f, url);
      if (blocks.some(b => b.src === src)) continue;
      if (root && root.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_PRECEDING) above.push({ t: 'embed', src });
      else blocks.push({ t: 'embed', src });
    }
    blocks.unshift(...above);
    // The story's video above its text, where a lead picture would be: the first in the article before the text, outside
    // anything left out (Dinside, NRK's clips at the top).
    if (withImages && root) {
      let lead = false;
      const box = root.parentElement?.closest('article, main') || doc.querySelector('article, main');
      for (const c of box?.querySelectorAll(LEAD_VIDEO) || []) {
        if (c.contains(root) || !(root.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING) || c.closest(skip)) continue;
        const v = c.tagName === 'IFRAME' ? readerPlayerFrame(c, url) : readerPlayer(c, url) || (c.tagName === 'VIDEO' ? readerVideo(c, url) : null);
        if (v && !blocks.some(b => b.t === 'video' && readerVideoKey(b) === readerVideoKey(v))) { blocks.unshift({ t: 'video', ...v }); lead = true; break; }
      }
      // Else its picture there, in a figure of the article's own (NRK's new pages put it in the header, apart from the text).
      const art = root.parentElement?.closest('article');
      for (const img of lead || !art ? [] : art.querySelectorAll('figure img')) {
        if (!(root.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_PRECEDING) || img.closest(skip) || img.closest('a[href]')) continue;
        const src = readerImage(img, url);
        if (!src) continue;
        if (!blocks.some(b => b.t === 'img' && b.src === src)) {
          const cap = img.closest('figure').querySelector('figcaption');
          blocks.unshift({ t: 'img', src, caption: cap ? readerText(cap) : '' });
        }
        break;
      }
    }
  }
  // The entry's own heading is the reader's headline already.
  if (entry) for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].t === 'h' && blocks[i].text === title) blocks.splice(i, 1);
  // Headings with nothing after them are links to other stories (BBC's "more on this").
  while (blocks.length && blocks[blocks.length - 1].t === 'h') blocks.pop();
  // A picture series (Amedia's "Bildeserie", /g/ pages): little text of its own, and pictures with captions that are not
  // figures in the body the text was found in. All of them, each with its caption, in the order of the page.
  let series = false;
  const textLen = () => blocks.reduce((n, b) => n + (b.t === 'img' ? 0 : (b.text || '').length + (b.items || []).join(' ').length), 0);
  if (withImages && !feed && !entry && textLen() < 200) {
    const body = doc.querySelector('[itemprop="articleBody"], article, main'), pics = [], seen = new Set();
    for (const img of body?.querySelectorAll('img') || []) {
      if (img.closest(skip) || img.closest('a[href]')) continue;
      const src = readerImage(img, url); if (!src || seen.has(src)) continue;
      seen.add(src);
      let cap = null;
      for (let box = img.parentElement, i = 0; box && box !== body && i < 6 && !cap; box = box.parentElement, i++) {
        if (box.querySelectorAll('img').length > 1) break;
        cap = box.querySelector('figcaption, [class*="caption" i]');
      }
      pics.push({ t: 'img', src, caption: cap ? readerText(cap) : '' });
    }
    if (pics.length >= 3) { series = true; for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].t === 'img') blocks.splice(i, 1); blocks.push(...pics); }
  }
  // The story's own picture leads when the body has none of its own.
  if (withImages && !feed && !blocks.some(b => b.t === 'img' || b.t === 'video')) {
    try {
      const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (og && !/logo/i.test(og)) blocks.unshift({ t: 'img', src: new URL(og, url).href, caption: '' });
    } catch {}
  }
  const words = blocks.reduce((n, b) => n + (b.text || '').length + (b.items || []).join(' ').length, 0);
  // A full article runs to thousands of characters; a paid one far shorter is what the site let through.
  if (paid && words < 1500) return { blocks: blocks.filter(b => (b.t !== 'img' && b.t !== 'video') || words >= 200), date, byline, paid, partial: true };
  if (words >= 200) return { blocks, date, byline, paid, partial: false };
  if (series) return { blocks, date, byline, paid, partial: false };
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
const SAYS_ARTICLE = /"@type"\s*:\s*\[?\s*"(?:\w*Article|Review)"|<meta[^>]*og:type[^>]*content="article"/;
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
