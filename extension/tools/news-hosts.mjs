#!/usr/bin/env node
// Builds src/engine/news-hosts.json: the hosts of known news sites, from open sources. The build
// (build.mjs) turns it into NEWS_LIST in the content script; sites.js counts a host on it as a news
// site unless the page itself is a shop or a wiki. Unlisted sites still go through isPublication().
//
// Sources (all public, no sign-in):
//   - Wikidata (query.wikidata.org): items that are instances of newspaper, daily newspaper, online
//     newspaper, news website, news portal, digital newspaper, news magazine, news agency or news
//     channel (or a subclass), with an official website (P856). Defunct items (P576, P2669) and
//     websites with an end date are left out. Country (P17) and language (P407) are kept for review.
//   - Mediebedriftenes Landsforening (mediebedriftene.no): member companies in "Media - Aviser".
//   - Landslaget for lokalaviser (lla.no): the member papers on its map.
//   - Norsk Presseforbund (presse.no): the media in the PFU scheme, matched to websites by name.
//   - Public Suffix List (publicsuffix.org), to find each host's registrable domain.
// Not used: Medietilsynet's media database and subsidy lists name papers but give no websites (and
// come as XLSX/PDF), Norsk Redaktørforening publishes no member list, Fagpressen is trade magazines.
//
// Hosts are normalised to the registrable domain (www.nrk.no → nrk.no) unless the site lives on a
// subdomain of something broader (news.sky.com stays). Social networks, video platforms,
// aggregators, blog and publishing platforms, shops and portals are excluded (EXCLUDE below).
// Then every front page is fetched once to drop dead, parked, spam and shop domains (Verifying).
//
//   node tools/news-hosts.mjs              fetch everything and write src/engine/news-hosts.json
//   node tools/news-hosts.mjs --report     also print what was dropped and why, for review
//   node tools/news-hosts.mjs --no-verify  skip the front-page checks
//   NEWS_HOSTS_CACHE=/tmp/nh node tools/news-hosts.mjs   reuse raw responses and checks saved in that folder
// DNS lookups run on libuv's thread pool (4 threads by default), which would cap the parallel checks.
process.env.UV_THREADPOOL_SIZE ||= '64';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src', 'engine', 'news-hosts.json');
const REPORT = process.argv.includes('--report');
const CACHE = process.env.NEWS_HOSTS_CACHE;
const UA = 'NoThis-news-hosts/1.0 (https://github.com/Zindre/userscripts; news site list for a browser extension)';

// ───────────────────────────── Exclusions ─────────────────────────────
// Registrable domains (or exact hosts) that are never news sites in their own right, even when a
// source lists a paper's page on them: social networks, video and audio platforms, aggregators and
// portals, blog/publishing/site-builder platforms, document hosts, shops and marketplaces, and
// publishers' corporate sites. A host matches an entry when it equals it or is a subdomain of it.
const EXCLUDE = [
  // social networks and messaging
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 't.co', 'threads.net', 'tiktok.com', 'linkedin.com', 'vk.com', 'vkontakte.ru', 'ok.ru',
  't.me', 'telegram.me', 'telegram.org', 'whatsapp.com', 'pinterest.com', 'reddit.com', 'tumblr.com', 'snapchat.com', 'weibo.com', 'weibo.cn', 'mastodon.social',
  'bsky.app', 'discord.com', 'discord.gg', 'line.me', 'kakao.com', 'quora.com', 'gab.com', 'truthsocial.com', 'parler.com', 'gettr.com', 'minds.com',
  // video and audio platforms
  'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'twitch.tv', 'rumble.com', 'bitchute.com', 'odysee.com', 'soundcloud.com', 'spotify.com',
  'podcasts.apple.com', 'anchor.fm', 'podbean.com', 'mixcloud.com', 'bilibili.com', 'youku.com', 'rutube.ru', 'livestream.com', 'ustream.tv',
  // aggregators, search and portals
  'google.com', 'news.google.com', 'yahoo.com', 'yahoo.co.jp', 'msn.com', 'bing.com', 'flipboard.com', 'feedly.com', 'newsnow.co.uk', 'apple.com', 'smartnews.com',
  'ground.news', 'allsides.com', 'newsbreak.com', 'inshorts.com', 'upday.com', 'squid-app.co', 'opera.com', 'naver.com', 'daum.net', 'baidu.com', 'yandex.ru',
  'yandex.com', 'mail.ru', 'rambler.ru', 'sohu.com', 'sina.com.cn', 'qq.com', '163.com', 'ifeng.com', 'aol.com', 'drudgereport.com', 'newsblur.com', 'pressreader.com',
  'newspaperdirect.com', 'magzter.com', 'readly.com', 'zinio.com', 'paperboy.com', 'onlinenewspapers.com', 'abyznewslinks.com', 'startsiden.no',
  // blog, publishing and site-builder platforms
  'wordpress.com', 'wordpress.org', 'blogspot.com', 'blogger.com', 'medium.com', 'substack.com', 'ghost.io', 'wix.com', 'wixsite.com', 'weebly.com', 'squarespace.com',
  'tilda.ws', 'webnode.com', 'jimdo.com', 'jimdofree.com', 'site123.me', 'strikingly.com', 'yolasite.com', 'over-blog.com', 'livejournal.com', 'typepad.com',
  'github.io', 'github.com', 'gitlab.io', 'netlify.app', 'vercel.app', 'herokuapp.com', 'sites.google.com', 'blogs.com', 'canalblog.com', 'hatenablog.com',
  'ameblo.jp', 'naver.me', 'tistory.com', 'linktr.ee', 'bit.ly', 'about.me', 'patreon.com', 'beehiiv.com', 'mailchimp.com', 'list-manage.com', 'campaign-archive.com',
  // document and archive hosts, encyclopedias
  'issuu.com', 'calameo.com', 'yumpu.com', 'scribd.com', 'archive.org', 'archive.today', 'archive.ph', 'wikipedia.org', 'wikimedia.org', 'wikidata.org',
  'wikisource.org', 'europeana.eu', 'chroniclingamerica.loc.gov', 'loc.gov', 'trove.nla.gov.au', 'nb.no', 'kb.se', 'delpher.nl', 'gallica.bnf.fr', 'retronews.fr',
  'newspapers.com', 'newspaperarchive.com', 'britishnewspaperarchive.co.uk', 'newsbank.com', 'serialssolutions.com', 'proquest.com', 'umi.com',
  'e-newspaperarchives.ch', 'digar.ee', 'virginiachronicle.com', 'newsrx.com', 'newsrx.net', 'grantsandfunding.net', 'housinganddevelopment.com', 'eluta.ru', 'dropbox.com', 'box.com', 'drive.google.com', 'docs.google.com',
  // publishers' corporate sites and media service firms, government
  'amedia.as', 'amedia.no', 'aller.no', 'aller.com', 'schibsted.com', 'schibsted.no', 'polarismedia.no', 'mentormedier.no', 'retriever.no', 'helthjem.no',
  'warnerbrosdiscovery.no', 'tv3.no', 'simply.tv', 'publishlab.com', 'stocklink.no', 'telefontjenester.no', 'forsvaret.no', 'regjeringen.no', 'stortinget.no',
  'kommune.no', 'fylkeskommune.no',
  // shops, marketplaces, classifieds
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'ebay.com', 'etsy.com', 'aliexpress.com', 'alibaba.com', 'myshopify.com', 'shopify.com', 'finn.no', 'blocket.se',
  'tradera.com', 'zalando.com', 'rakuten.co.jp', 'mercadolibre.com', 'taobao.com', 'jd.com', 'flipkart.com', 'craigslist.org', 'gumtree.com',
];

// Wikidata subclasses that are not news sites (gazettes, school and in-house papers, aggregators).
const EXCLUDE_CLASSES = [
  'Q498267',    // news aggregator
  'Q28933155',  // news aggregation website
  'Q120061681', // Lemmy instance
  'Q27881073',  // fake news website
  'Q111735921', // blog search engine
  'Q480422',    // Amtsblatt
  'Q2065227',   // government gazette
  'Q87527714',  // collection of administrative acts of the prefectures
  'Q832165',    // house journal
  'Q738377',    // student newspaper
  'Q106162750', // college student newspapers and periodicals
  'Q321745',    // Abiturzeitung
  'Q569348',    // wall newspaper
  'Q1514286',   // zero issue
  'Q2048876',   // cable newspaper
];
const ROOT_CLASSES = {
  Q11032: 'newspaper', Q1110794: 'daily newspaper', Q1153191: 'online newspaper', Q17232649: 'news website', Q25434592: 'news portal',
  Q5276122: 'digital newspaper', Q1684600: 'news magazine', Q192283: 'news agency', Q115477322: 'news channel',
};

// ───────────────────────────── Fetching ─────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, { accept = '*/*', ua = UA } = {}) {
  const file = CACHE && join(CACHE, createHash('sha1').update(url).digest('hex'));
  if (file && existsSync(file)) return readFileSync(file, 'utf8');
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': ua, Accept: accept } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      const text = await res.text();
      if (file) { mkdirSync(CACHE, { recursive: true }); writeFileSync(file, text); }
      return text;
    } catch (e) {
      if (e.fatal || attempt >= 4) throw e;
      await sleep(5000 * attempt);
    }
  }
}
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const sparql = async q => JSON.parse(await get('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { accept: 'application/sparql-results+json' })).results.bindings;

// ───────────────────────────── Public Suffix List ─────────────────────────────
let psl;
async function loadPsl() {
  const rules = new Set(), wild = new Set(), except = new Set();
  for (let line of (await get('https://publicsuffix.org/list/public_suffix_list.dat')).split('\n')) {
    line = line.trim();
    if (!line || line.startsWith('//')) continue;
    const r = new URL('http://' + line.replace(/^[!*]\.?/, '') + '/').hostname; // punycode, like location.hostname
    if (line.startsWith('!')) except.add(r); else if (line.startsWith('*.')) wild.add(r); else rules.add(r);
  }
  psl = { rules, wild, except };
}
// The registrable domain (eTLD+1) of a punycoded host, or null for a bare public suffix.
function registrable(host) {
  const p = host.split('.');
  let suffix = 1; // labels in the public suffix; the default rule is "*"
  for (let i = 0; i < p.length; i++) { // longest match first
    const s = p.slice(i).join('.');
    if (psl.except.has(s)) { suffix = p.length - i - 1; break; }
    if (psl.rules.has(s) || (i + 1 < p.length && psl.wild.has(p.slice(i + 1).join('.')))) { suffix = p.length - i; break; }
  }
  return suffix < p.length ? p.slice(-suffix - 1).join('.') : null;
}

// ───────────────────────────── Normalising ─────────────────────────────
// Subdomains that say nothing about the site: dropped, so www.vg.no and m.vg.no both give vg.no.
const GENERIC_SUB = /^(?:www\d*|m|mobile|mobil|amp|edition|beta|web|new|home|en|eng|english|int|international|global|eu)$/; // eu.: Gannett's site for European visitors
// Paths that still mean "the front page".
const FRONT_PATH = /^\/(?:(?:index|default|home|start|main)(?:\.\w{2,5})?|[a-z]{2}(?:-[a-z]{2})?|portal|news|nyheter|web)?\/?$/i;
const excluded = h => EXCLUDE.some(e => h === e || h.endsWith('.' + e)) || /(^|\.)blogspot\.[a-z.]+$|(^|\.)wordpress\.|(^|\.)google\.[a-z.]+$|(^|\.)amazon\.[a-z.]+$|(^|\.)ebay\.[a-z.]+$/.test(h);

// Returns { host } or { drop: reason }.
function normalise(raw) {
  let u;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw.trim()) ? raw.trim() : 'http://' + raw.trim()); } catch { return { drop: 'bad url' }; }
  if (!/^https?:$/.test(u.protocol)) return { drop: 'not http' };
  let h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (/^\d+\.\d+\.\d+\.\d+$|^\[/.test(h) || !h.includes('.')) return { drop: 'ip or bare host' };
  const reg = registrable(h);
  if (!reg) return { drop: 'public suffix' };
  if (excluded(h) || excluded(reg) || /^(?:app|apps|login|account|abo|kundeservice|minside)\./.test(h) || /\.app\./.test(h)) return { drop: 'excluded platform' };
  // A paper's page deep inside a bigger site is that site's section, not a news site of its own.
  if (!FRONT_PATH.test(u.pathname)) return { drop: 'path', host: h };
  let labels = h.slice(0, -reg.length - 1).split('.').filter(Boolean);
  while (labels.length && GENERIC_SUB.test(labels[0])) labels.shift();
  return { host: labels.length ? labels.join('.') + '.' + reg : reg };
}

// ───────────────────────────── Sources ─────────────────────────────
async function wikidata(add) {
  const exclude = EXCLUDE_CLASSES.map(q => 'wd:' + q).join(' ');
  const classes = new Set();
  for (const q of Object.keys(ROOT_CLASSES)) {
    const rows = await sparql(`SELECT ?s WHERE { ?s wdt:P279* wd:${q} . FILTER NOT EXISTS { VALUES ?x { ${exclude} } ?s wdt:P279* ?x } }`);
    for (const r of rows) classes.add(r.s.value.split('/').pop());
  }
  const list = [...classes];
  let n = 0;
  for (let i = 0; i < list.length; i += 40) {
    const values = list.slice(i, i + 40).map(q => 'wd:' + q).join(' ');
    // wdt:P856 gives the best-ranked websites only (preferred over normal, never deprecated).
    const rows = await sparql(`SELECT ?item ?w (SAMPLE(?cc) AS ?c) (SAMPLE(?lc) AS ?l) (SAMPLE(?sl) AS ?links) WHERE {
      VALUES ?cls { ${values} }
      ?item wdt:P31 ?cls ; wdt:P856 ?w ; wikibase:sitelinks ?sl .
      FILTER NOT EXISTS { ?item p:P856 [ ps:P856 ?w ; pq:P582 [] ] }
      FILTER NOT EXISTS { ?item wdt:P576 [] } FILTER NOT EXISTS { ?item wdt:P2669 [] }
      OPTIONAL { ?item wdt:P17/wdt:P297 ?cc } OPTIONAL { ?item wdt:P407/wdt:P218 ?lc }
    } GROUP BY ?item ?w`);
    for (const r of rows) { add(r.w.value, 'wikidata', { id: r.item.value.split('/').pop(), country: r.c?.value, lang: r.l?.value, links: +r.links.value }); n++; }
    await sleep(1000);
  }
  return `${n} websites of ${classes.size} classes`;
}

// Mediebedriftenes Landsforening: the member list is paged; each page carries a schema.org ItemList.
const MBL_NOT_PAPERS = /distribusjon|mediapost|marked|ressurs|design|service|trykk|tjenester|netthandel|eiendom|holding|annonse|teknologi|logistikk|avisbud|\bcms\b|inflow|utvikling|konsern|\bgroup\b|\bgruppen\b/i;
async function mbl(add) {
  let n = 0, seen = new Set();
  for (let page = 1; page < 30; page++) {
    const html = await get(`https://www.mediebedriftene.no/om-mbl/vare-medlemmer/?page=${page}`, { ua: BROWSER_UA });
    let items = [];
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { const j = JSON.parse(m[1]); if (j.mainEntity?.itemListElement) items = j.mainEntity.itemListElement; } catch {}
    }
    if (!items.length) break;
    const fresh = items.filter(x => !seen.has(JSON.stringify(x.item)));
    if (!fresh.length) break;
    for (const x of fresh) {
      seen.add(JSON.stringify(x.item));
      // Members are companies: papers, but also their printers, distributors and service firms.
      if (/^Media - Aviser/.test(x.item.description || '') && x.item.url && !MBL_NOT_PAPERS.test(x.item.name)) { add(x.item.url, 'mbl', { country: 'NO', lang: 'no', name: x.item.name }); n++; }
    }
    await sleep(500);
  }
  return `${n} newspaper members`;
}

// The JSON object or array that starts at text[i], found by counting brackets outside strings.
function jsonAt(text, i) {
  let depth = 0, str = false;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (str) { if (c === '\\') j++; else if (c === '"') str = false; }
    else if (c === '"') str = true;
    else if (c === '{' || c === '[') depth++;
    else if ((c === '}' || c === ']') && --depth === 0) return JSON.parse(text.slice(i, j + 1));
  }
  throw new Error('unterminated JSON');
}

// Landslaget for lokalaviser: the member map on lla.no/finn-din-lokalavis/ is an iframe whose page
// carries every member paper as a JSON blob (name, county, website, and contact details we ignore).
async function lla(add) {
  const html = await get('https://samarbeidsdesken.no/lla-kart/', { ua: BROWSER_UA });
  const at = html.indexOf('nrpMapLocationsSettings');
  if (at < 0) throw new Error('member map not found');
  let n = 0;
  for (const m of jsonAt(html, html.indexOf('{', at)).markers || []) {
    if (m.data?.website) { add(m.data.website, 'lla', { country: 'NO', lang: 'no', name: m.data.name || m.name }); n++; }
  }
  return `${n} member papers`;
}

// Norsk Presseforbund: the media that answer to the Press Complaints Commission (PFU), i.e. that
// follow Vær Varsom and Redaktørplakaten. The complaint form lists them, by name only, in its
// Next.js payload. Names are matched to websites through the names MBL and LLA give for their
// members, then through the labels of Norwegian media items on Wikidata that have a website.
const nameKey = n => n.toLowerCase().normalize('NFC').replace(/\b(?:as|asa|sa|da|ans|avis)\b/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
const knownNames = new Map(); // nameKey → Set of hosts, from the sources above
async function pfu(add) {
  const html = await get('https://www.presse.no/klageskjema', { ua: BROWSER_UA });
  const names = [...new Set([...html.matchAll(/\{\\"_id\\":\\"[^\\]+\\",\\"name\\":\\"(.*?)\\"\}/g)].map(m => JSON.parse(`"${m[1]}"`)))];
  if (names.length < 100) throw new Error(`only ${names.length} names found`);
  const wd = new Map(), rows = [];
  // Norwegian media items: mass media, website, periodical, radio station, broadcaster, TV channel,
  // news media, magazine, newspaper. One query per class; together they time out.
  for (const m of ['Q11033', 'Q35127', 'Q1002697', 'Q14350', 'Q15265344', 'Q2001305', 'Q1193236', 'Q41298', 'Q11032']) {
    rows.push(...await sparql(`SELECT DISTINCT ?l ?w WHERE {
      ?item wdt:P17 wd:Q20 ; wdt:P856 ?w ; wdt:P31/wdt:P279* wd:${m} . FILTER NOT EXISTS { ?item wdt:P576 [] }
      { ?item rdfs:label ?l } UNION { ?item skos:altLabel ?l } FILTER(LANG(?l) IN ("nb", "nn", "no", "en", "se"))
    }`));
    await sleep(1000);
  }
  for (const r of rows) { const k = nameKey(r.l.value), h = normalise(r.w.value).host; if (k && h) (wd.get(k) || wd.set(k, new Set()).get(k)).add(h); }
  let n = 0, guesses = 0, guessed;
  const unmatched = [];
  for (const name of names) {
    const k = nameKey(name);
    const found = knownNames.get(k)?.size === 1 ? knownNames.get(k) : wd.get(k)?.size === 1 ? wd.get(k) : null;
    if (found) { add('https://' + [...found][0] + '/', 'pfu', { country: 'NO', lang: 'no', name }); n++; }
    else if (!wd.get(k) && (guessed = await guess(name))) { add('https://' + guessed + '/', 'pfu', { country: 'NO', lang: 'no', name }); n++; guesses++; }
    else unmatched.push(name + (wd.get(k) ? ` (${[...wd.get(k)].join(', ')})` : ''));
  }
  if (REPORT) console.log(`\n## PFU names without a website (${unmatched.length})\n${unmatched.join('\n')}`);
  return `${n} of ${names.length} media matched to a website (${guesses} by name.no)`;
}
// The paper's own domain, tried as name.no (or the name itself when it is a domain): taken only when
// the page's title or site name contains the paper's name, so an unrelated business never slips in.
async function guess(name) {
  const k = nameKey(name);
  if (k.length < 4 || /\(|\//.test(name)) return null;
  const tries = /\.no$/i.test(name) ? [name.toLowerCase()] : [...new Set([k + '.no', name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') + '.no'])];
  for (const t of tries) {
    let h;
    try { h = new URL('http://' + t).hostname; } catch { continue; }
    const file = CACHE && join(CACHE, 'guess-' + h);
    const r = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : await probe('https://' + h + '/');
    if (file) writeFileSync(file, JSON.stringify({ ...r, html: (r.html || '').slice(0, 20000) }));
    if (r.error || r.status >= 400) continue;
    const title = (r.html.match(/<title[^>]*>([^<]*)/i)?.[1] || '') + ' ' + (r.html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)/i)?.[1] || '');
    // "name.no" in the title does not count: lapsed domains turned into spam put it there.
    const own = new RegExp(t.replace(/\.no$/, '').replace(/[^\p{L}\p{N}]+/gu, '[^\\p{L}\\p{N}]*') + '\\.no', 'giu');
    const text = title.replace(/&#?\w+;/g, ' ').replace(own, ' ');
    if (!/lån|kreditt|casino|leiebil|poker/i.test(title) && nameKey(text).includes(k)) return h;
  }
  return null;
}

// ───────────────────────────── Verifying ─────────────────────────────
// Sources go stale: papers close and their domains lapse to parking pages, shops or gambling spam,
// or move to a new domain. Each host's front page is fetched once (in parallel) and the host is
// dropped when its name no longer resolves or refuses connections, the page is gone (404/410), or
// it is a parked domain, a shop or gambling spam. A redirect to another domain replaces the host
// with the new one. Bot walls (401/403/429/451/5xx) and timeouts keep the host: big news sites
// often block scripts, and US papers often block European visitors.
const PARKED = /domain (?:name )?(?:is |may be )?(?:for sale|available)|buy this domain|this domain (?:has expired|is parked|was registered)|domain parking|sedoparking|parkingcrew|bodis\.com|dan\.com\/|afternic|hugedomains|domainmarket|parklogic|above\.com\/|undeveloped\.com|domaintools|\bdomain-for-sale\b/i;
// The same news words as NEWS_WORDS in sites.js.
const NEWS_WORDS = /\b(?:nyheter|nyheder|nyhet\w*|avis\w*|tidende|tidning\w*|news|newspaper|headlines|breaking|nachrichten|zeitung|aktuell\w*|actualit\w*|journal|noticias|notizie|nieuws|uutiset|uutis\w*)\b/i;
const SPAM = /\b(?:slots?|gacor|casino|judi|togel|poker|bokep|bandar|sbobet|maxwin|betting|bet88|escort|porn|viagra|cialis)\b/i;
async function probe(url) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*', 'Accept-Language': 'en,no;q=0.8' }, redirect: 'follow', signal: ctl.signal });
    let html = '';
    if (/html|xml|^$/i.test(res.headers.get('content-type') || '')) {
      const reader = res.body.getReader(), dec = new TextDecoder();
      while (html.length < 400000) { const { done, value } = await reader.read(); if (done) break; html += dec.decode(value, { stream: true }); }
      reader.cancel().catch(() => {});
    } else res.body?.cancel().catch(() => {});
    return { status: res.status, url: res.url, type: res.headers.get('content-type') || '', html };
  } catch (e) {
    return { error: e.cause?.code || e.name || String(e) };
  } finally { clearTimeout(timer); }
}
async function check(host) {
  let r;
  for (const url of [`https://${host}/`, `https://www.${host}/`, `http://${host}/`]) {
    r = await probe(url);
    if (!r.error || /TIMEOUT|Abort/i.test(r.error)) break; // a slow site is slow on every address
  }
  if (r.error) return /ENOTFOUND|EAI_NONAME|ECONNREFUSED|ERR_INVALID_URL/.test(r.error) && !/TIMEOUT|Abort/i.test(r.error) ? { drop: `unreachable (${r.error})` } : { keep: `unverified (${r.error})` };
  if (r.status === 404 || r.status === 410) return { drop: `HTTP ${r.status}` };
  if (r.status >= 400) return { keep: `unverified (HTTP ${r.status})` };
  const head = (r.html.match(/<title[^>]*>([^<]*)/i)?.[1] || '') + ' ' + (r.html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] || '');
  if (!r.html && !/html/i.test(r.type)) return { drop: `not a web page (${r.type})` };
  if (PARKED.test(r.html.slice(0, 60000)) && r.html.length < 60000) return { drop: 'parked domain' };
  if (SPAM.test(head)) return { drop: `spam: ${head.trim().slice(0, 80)}` };
  // A shop: Shopify, products, or a front page full of cart buttons. Papers sell subscriptions through
  // WooCommerce, so a few cart buttons (up to 20 or so) are normal on a news site.
  if (/cdn\.shopify\.com|Shopify\.theme/.test(r.html) || (r.html.match(/"@type"\s*:\s*"Product"/g) || []).length >= 3 ||
    (r.html.match(/add[-_]to[-_]cart/gi) || []).length >= 30) return { drop: `shop: ${head.trim().slice(0, 80)}` };
  let to;
  try { to = new URL(r.url); } catch {}
  if (to && registrable(to.hostname) !== registrable(host)) {
    // Consent, sign-in and app pages, or a section of a bigger site: the host itself still serves the paper.
    if (/consent|privacy|cmp|login|auth|account|^app\./i.test(to.hostname) || !FRONT_PATH.test(to.pathname)) return { keep: `unverified (redirects to ${to.hostname}${to.pathname})` };
    // Lapsed domains forward to anything, so the new site has to look like news itself.
    const newsy = /<link[^>]+type=["']application\/(?:rss|atom)\+xml|"@type"\s*:\s*"(?:NewsArticle|NewsMediaOrganization|Article|ReportageNewsArticle)"|<meta[^>]+property=["']og:type["'][^>]+content=["']article/i.test(r.html) ||
      (r.html.match(/<article[\s>]/gi) || []).length >= 5 || NEWS_WORDS.test(head);
    if (!newsy) return { drop: `redirects to ${to.hostname}, which does not look like news` };
    const n = normalise(to.origin + '/');
    return n.host ? { moved: n.host } : { drop: `redirects to ${to.hostname} (${n.drop})` };
  }
  return { keep: 'ok' };
}
async function verifyAll(list) {
  const file = CACHE && join(CACHE, 'verify.json');
  const done = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const todo = list.filter(h => !done[h]);
  let i = 0, n = 0;
  await Promise.all(Array.from({ length: 48 }, async () => {
    while (i < todo.length) {
      const h = todo[i++];
      done[h] = await check(h);
      if (++n % 250 === 0) { console.error(`verified ${n}/${todo.length}`); if (file) writeFileSync(file, JSON.stringify(done)); }
    }
  }));
  if (file) writeFileSync(file, JSON.stringify(done));
  return done;
}

// ───────────────────────────── Main ─────────────────────────────
const SOURCES = { wikidata, mbl, lla, pfu }; // pfu last: it maps names through the others

await loadPsl();
const hosts = new Map(); // host → { sources: Set, ids: Set, country: Map }
const dropped = [];
function add(url, source, info = {}) {
  const r = normalise(url);
  if (!r.host || r.drop) { dropped.push({ url, source, why: r.drop, ...info }); return; }
  let e = hosts.get(r.host);
  if (!e) hosts.set(r.host, e = { sources: new Set(), ids: new Set(), countries: {}, langs: {} });
  e.sources.add(source);
  if (info.id) e.ids.add(info.id);
  e.links = Math.max(e.links || 0, info.links ?? (source === 'wikidata' ? 0 : 1)); // Wikipedia articles about it
  if (info.country) e.countries[info.country] = (e.countries[info.country] || 0) + 1;
  if (info.lang) e.langs[info.lang] = (e.langs[info.lang] || 0) + 1;
  if (info.name && source !== 'pfu') { const k = nameKey(info.name); (knownNames.get(k) || knownNames.set(k, new Set()).get(k)).add(r.host); }
}
const counts = {};
for (const [name, fn] of Object.entries(SOURCES)) {
  try { counts[name] = await fn(add); } catch (e) { counts[name] = `failed: ${e.message}`; }
  console.error(`${name}: ${counts[name]}`);
}

// A host that many Wikidata items share is a platform or a group's portal, not one news site.
const SHARED = 6;
for (const [h, e] of hosts) if (e.ids.size >= SHARED && e.sources.size === 1) { dropped.push({ url: h, source: 'wikidata', why: `shared by ${e.ids.size} items` }); hosts.delete(h); }
const coverParent = () => { // a subdomain of a listed host is covered by it
  for (const h of [...hosts.keys()]) {
    const p = h.split('.');
    for (let i = 1; i < p.length - 1; i++) if (hosts.has(p.slice(i).join('.'))) { hosts.delete(h); break; }
  }
};
coverParent();
const verdicts = {};
if (!process.argv.includes('--no-verify')) {
  const results = await verifyAll([...hosts.keys()]);
  for (const [h, r] of Object.entries(results)) {
    const e = hosts.get(h);
    if (!e) continue;
    const kind = r.drop ? 'dropped' : r.moved ? 'moved' : r.keep === 'ok' ? 'ok' : 'unverified';
    verdicts[kind] = (verdicts[kind] || 0) + 1;
    if (r.drop) { hosts.delete(h); dropped.push({ url: h, source: [...e.sources].join('+'), why: 'verify: ' + r.drop.replace(/:.*/, ''), detail: r.drop }); }
    // Nothing vouches for a site that only a Wikidata item without any Wikipedia article lists and
    // whose front page could not be checked: most are small papers that closed or block Europe.
    else if (kind === 'unverified' && !e.links && [...e.sources].every(s => s === 'wikidata')) {
      hosts.delete(h); verdicts.unverified--; verdicts.dropped++;
      dropped.push({ url: h, source: 'wikidata', why: 'unverified, no Wikipedia article', detail: r.keep });
    }
    else if (r.moved && r.moved !== h) {
      hosts.delete(h);
      if (excluded(r.moved)) { dropped.push({ url: h, source: [...e.sources].join('+'), why: 'verify: moved to a platform', detail: r.moved }); continue; }
      const t = hosts.get(r.moved);
      if (t) { for (const s of e.sources) t.sources.add(s); for (const id of e.ids) t.ids.add(id); }
      else hosts.set(r.moved, e);
    }
  }
  coverParent();
  counts.verified = verdicts;
  console.error('verify:', verdicts);
}

const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0];
const byCountry = {};
for (const [h, e] of [...hosts].sort((a, b) => a[0].localeCompare(b[0]))) (byCountry[(top(e.countries) || '').toLowerCase() || '-'] ||= []).push(h);
const ordered = Object.fromEntries(Object.entries(byCountry).sort((a, b) => b[1].length - a[1].length));
const langs = {};
for (const e of hosts.values()) { const l = top(e.langs) || '-'; langs[l] = (langs[l] || 0) + 1; }

writeFileSync(OUT, JSON.stringify({
  about: 'Known news sites for NoThis, generated by extension/tools/news-hosts.mjs. Do not edit by hand: change the script and run it again.',
  generated: new Date().toISOString().slice(0, 10),
  sources: counts,
  total: hosts.size,
  languages: Object.fromEntries(Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 25)),
  hosts: ordered,
}, null, 1) + '\n');
console.error(`${hosts.size} hosts → ${OUT}`);

if (REPORT) {
  const why = {};
  for (const d of dropped) (why[d.why] ||= []).push(d);
  for (const [w, list] of Object.entries(why)) {
    console.log(`\n## dropped: ${w} (${list.length})`);
    for (const d of list.slice(0, w === 'path' ? 400 : 200)) console.log(`${d.source}\t${d.id || ''}\t${d.url}\t${(d.detail || '').replace(/\s+/g, ' ')}`);
  }
  console.log('\n## hosts claimed by 3+ Wikidata items');
  for (const [h, e] of hosts) if (e.ids.size >= 3) console.log(`${e.ids.size}\t${h}\t${[...e.ids].slice(0, 5).join(' ')}`);
}
