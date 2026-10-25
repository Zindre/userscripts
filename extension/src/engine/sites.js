// ───────────────────────────── Special cases ─────────────────────────────
// Labels that sites glue onto teaser text (paywall badges, section names, screen-reader
// prefixes). Removed from the start of every teaser and fetched title before anything else.
// Add one regex per label; keep them anchored with ^ so ordinary words are never touched.
const LABELS = [
  /^(?:[A-ZÆØÅÄÖ0-9]{1,12}\+|Premium|Plus|Pluss|Abo|Weltplus Artikel|Spiegel\+|Bild ?Plus|Exklusiv|Exclusive)\s*[,:–—-]?\s+/i,
  /^(?:Kommentar|Leder|Debatt|Analyse|Meninger|Kronikk|Opinion|Analysis|Comment|Review|Anmeldelse|Ledare|Krönika|Debat)\s*[,:]\s+/i,
];

// Per-site config. `article` matches URLs worth fetching. Optional `strip`: extra regexes
// removed from that site's teasers only (same idea as LABELS, but local to one host).
const SITES = [
  { host: /(^|\.)vg\.no$/,          article: /\/i\/[A-Za-z0-9]{5,}/ },
  { host: /(^|\.)e24\.no$/,         article: /\/i\/[A-Za-z0-9]{5,}/ },
  { host: /(^|\.)bt\.no$/,          article: /\/i\/[A-Za-z0-9]{5,}/ },
  { host: /(^|\.)aftenposten\.no$/, article: /\/i\/[A-Za-z0-9]{5,}/ },
  { host: /(^|\.)ba\.no$/,          article: /\/[a-z]{1,2}\/\d{1,3}-\d{1,3}-\d{4,}$/ }, // Amedia: /slug/s/80-8-27129
  { host: /(^|\.)dagbladet\.no$/,   article: /\/\d{7,}\/?$|\/video\/[^/]+\/[A-Za-z0-9]{6,}\/?$/ },
  { host: /(^|\.)nrk\.no$/,         article: /-1\.\d{7,}$|\/artikkel\/[^\/]*\d{6,}$/ },
  { host: /(^|\.)tv2\.no$/,         article: /\/\d{7,}\/?$/ },
  { host: /(^|\.)nettavisen\.no$/,  article: /\/\d{6,}|\/[a-z-]{6,}\/[a-z0-9-]{10,}/ },
  { host: /(^|\.)dn\.no$/,          article: /\/\d-\d-\d{6,}$/ },
  // Sweden / Denmark / Germany
  { host: /(^|\.)aftonbladet\.se$/,  article: /\/a\/[A-Za-z0-9]{5,}/ },
  { host: /(^|\.)expressen\.se$/,    article: /^\/[a-z-]+\/(?:[a-z-]+\/)*[a-z0-9]+(-[a-z0-9]+){2,}-?\/?$/ },
  { host: /(^|\.)svt\.se$/,          article: /^\/nyheter\/(?!video\/)[a-z-]+\/[a-z0-9]+(-[a-z0-9]+){2,}/ },
  { host: /(^|\.)dr\.dk$/,           article: /^\/(?:nyheder|sporten)\/.+\/[a-z0-9]+(-[a-z0-9]+){2,}/ },
  { host: /(^|\.)ekstrabladet\.dk$/, article: /\/article\d{6,}\.ece|\/\d{7,}$/ },
  // Finland
  { host: /(^|\.)yle\.fi$/,          article: /\/a\/\d{2,}-\d{5,}/ },
  { host: /(^|\.)hs\.fi$/,           article: /\/art-\d{10,}\.html/ },
  { host: /(^|\.)bild\.de$/,         article: /-[0-9a-f]{20,}$|\/[a-z0-9]+(-[a-z0-9]+){3,}/ },
  { host: /(^|\.)spiegel\.de$/,      article: /-a-[0-9a-f-]{20,}$|^\/[a-z]+\/(?:[a-z]+\/)?[a-z0-9]+(-[a-z0-9]+){3,}/ },
  { host: /(^|\.)welt\.de$/,         article: /\/(?:article|plus)[0-9a-f]{16,}\//, strip: [/^[A-Za-zäöü]+ - (?=.{15})/] },
  // UK / US
  { host: /(^|\.)bbc\.(com|co\.uk)$/, article: /\/(news|sport)\/[a-z0-9-]*\d{6,}|\/articles\/[a-z0-9]{10,}/ },
  { host: /(^|\.)theguardian\.com$/, article: /\/\d{4}\/[a-z]{3}\/\d{2}\// },
  { host: /(^|\.)dailymail\.(co\.uk|com)$/, article: /\/article-\d{6,}\// },
  { host: /(^|\.)thesun\.(co\.uk|ie)$/, article: /\/\d{7,}\// },
  { host: /(^|\.)mirror\.co\.uk$/,  article: /-\d{7,}$/ },
  { host: /(^|\.)independent\.co\.uk$/, article: /-b\d{6,}\.html$/ },
  { host: /(^|\.)telegraph\.co\.uk$/, article: /\/\d{4}\/\d{2}\/\d{2}\// },
  { host: /(^|\.)cnn\.com$/,         article: /\/\d{4}\/\d{2}\/\d{2}\// },
  { host: /(^|\.)nytimes\.com$/,     article: /\/\d{4}\/\d{2}\/\d{2}\/.+\.html$/ },
  { host: /(^|\.)washingtonpost\.com$/, article: /\/\d{4}\/\d{2}\/\d{2}\// },
  { host: /(^|\.)nypost\.com$/,      article: /\/\d{4}\/\d{2}\/\d{2}\// },
  { host: /(^|\.)foxnews\.com$/,     article: /^\/[a-z-]+\/[a-z0-9]+(-[a-z0-9]+){3,}$/ },
  { host: /(^|\.)huffpost\.com$/,    article: /\/entry\// },
  { host: /(^|\.)buzzfeed\.com$/,    article: /^\/[a-z0-9_]+\/[a-z0-9]+(-[a-z0-9]+){2,}/ },
  { host: /(^|\.)businessinsider\.com$/, article: /^\/[a-z0-9]+(-[a-z0-9]+){3,}/ },
  { host: /(^|\.)apnews\.com$/,      article: /\/article\// },
  { host: /(^|\.)abcnews\.(?:go\.)?com$/, article: /\/story$|\/wireStory\/[a-z0-9-]+-\d{6,}$/ }, // abcnews.go.com links to abcnews.com: /US/slug/story?id=123, /US/wireStory/slug-123
  { host: /(^|\.)reuters\.com$/,     article: /-\d{4}-\d{2}-\d{2}\/?$/ },
];
// Well-known news sites whose front pages carry few machine-readable news signals (no feed link,
// no <article>, no news JSON-LD), so the publication check can't see them. They count as news
// sites and use the generic article detection below. Strings match the host and its subdomains.
const NEWS_HOSTS = ['klassekampen.no', 'adressa.no', 'fvn.no', 'nordlys.no', 'dagsavisen.no', 'morgenbladet.no', 'bt.dk', 'berlingske.dk', 'politiken.dk', 'jyllands-posten.dk', 'svd.se', 'dn.se', 'gp.se', 'sydsvenskan.se',
  'metro.co.uk', 'standard.co.uk', 'inews.co.uk', 'express.co.uk', 'news.sky.com', 'ft.com', 'thetimes.com', 'nbcnews.com', 'cbsnews.com', 'abcnews.go.com', 'usatoday.com', 'latimes.com', 'npr.org', 'politico.com', 'axios.com',
  'theatlantic.com', 'time.com', 'cnbc.com', 'newsweek.com', 'cbc.ca', 'theglobeandmail.com', 'abc.net.au', 'smh.com.au', 'news.com.au', 'nzherald.co.nz', 'hindustantimes.com', 'timesofindia.indiatimes.com', 'ndtv.com',
  'sueddeutsche.de', 'faz.net', 'zeit.de', 'focus.de', 'tagesschau.de', 'krone.at', '20min.ch', 'lemonde.fr', 'lefigaro.fr', 'leparisien.fr', 'liberation.fr', 'francetvinfo.fr', 'elpais.com', 'elmundo.es', 'marca.com',
  '20minutos.es', 'corriere.it', 'repubblica.it', 'ilfattoquotidiano.it', 'nu.nl', 'telegraaf.nl'];
const newsHost = h => NEWS_HOSTS.some(n => h === n || h.endsWith('.' + n));
// Unlisted hosts. A path is article-like when it has a numeric id segment, an Amedia-style id
// (/slug/s/80-8-27129, ~80 Norwegian local papers), or a slug of 4+ tokens of which at least 3
// are real words. UUIDs and hex ids (web apps: /consoles/93552fcc-f6f1-4566-…) never count.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Never articles: author, tag and search pages, and shops (WooCommerce /produkt/, Shopify /products/ and /collections/).
const NOT_ARTICLE = /^\/(?:author|authors|profile|people|forfatter|journalist|tag|tags|topic|topics|tema-side|category|categories|kategori|search|suche|sok|søk|produkt|produkter|produktkategori|product|products|product-category|collections|shop|butikk|nettbutikk|store|cart|checkout|handlekurv|kasse)\//i;
function genericArticlePath(path) {
  if (UUID.test(path) || NOT_ARTICLE.test(path)) return false;
  if (/\/[a-z]{1,2}\/\d{1,3}-\d{1,3}-\d{4,}$/i.test(path)) return true;
  const segs = path.split('/').filter(Boolean);
  if (segs.some(sg => /^\d{5,}$/.test(sg))) return true;
  const last = (segs[segs.length - 1] || '').replace(/\.html?$/i, '');
  const tokens = last.split('-');
  return tokens.length >= 4 && tokens.filter(w => /^[a-z]{3,}$/i.test(w) && !/^[0-9a-f]+$/i.test(w)).length >= 3;
}
// Generic mode only runs on pages that look like a news publication, never on web apps, shops,
// price guides or wikis. Score: RSS/Atom feed 1, 5+ <article> elements 1 (20+: 2), article/frontpage og:type 1, news JSON-LD (NewsArticle, NewsMediaOrganization, …) 2,
// other article JSON-LD (Article, BlogPosting, …) 1, news words in the site's title or description 1.
// Needs 2.
// Shops (WooCommerce, Shopify, cart/checkout/product pages, product JSON-LD, pages full of prices,
// such as price guides) and wikis (MediaWiki) are always out.
const NEWS_WORDS = /\b(?:nyheter|nyheder|nyhet\w*|avis\w*|tidende|tidning\w*|news|newspaper|headlines|breaking|nachrichten|zeitung|aktuell\w*|actualit\w*|journal|noticias|notizie|nieuws|uutiset|uutis\w*)\b/i;
let publication = false;
function isPublication() {
  if (publication) return true;
  const q = sel => document.querySelector(sel);
  const body = document.body?.className || '';
  const ogType = q('meta[property="og:type"]')?.getAttribute('content') || '';
  const shop = /\b(woocommerce|shopify|cart|checkout|product|shop)\b/i.test(body) || /^product/i.test(ogType) ||
    !!q('script[src*="shopify"], link[href*="cdn.shopify.com"], form[action*="/cart"], [class*="add-to-cart"], [class*="add_to_cart"], [name="add-to-cart"]') ||
    /\/(cart|checkout|basket|handlekurv|kasse|product|products|produkt|shop|store)(\/|$)/i.test(location.pathname);
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(sc => sc.textContent).join(' ');
  const priced = /"@type"\s*:\s*"(?:Product|ProductGroup)"/.test(ld) || // not Offer: news sites offer subscriptions and apps
    document.querySelectorAll('[itemprop="price"], [class*="price" i]:not([class*="prize" i])').length >= 10;
  const wiki = /\bmediawiki\b/.test(body) || !!q('meta[name="generator"][content^="MediaWiki"]') || /^\/wiki\//.test(location.pathname);
  if (shop || priced || wiki) return false;
  let score = 0;
  if (q('link[rel="alternate"][type*="rss"], link[rel="alternate"][type*="atom"]')) score += 1;
  const articles = document.querySelectorAll('article').length;
  if (articles >= 20) score += 2; else if (articles >= 5) score += 1;
  if (/^(article|frontpage|blog)$/i.test(ogType)) score += 1;
  if (/"@type"\s*:\s*"(?:NewsArticle|NewsMediaOrganization|ReportageNewsArticle|AnalysisNewsArticle|LiveBlogPosting)"/.test(ld)) score += 2;
  else if (/"@type"\s*:\s*"(?:Article|BlogPosting|Blog|CollectionPage|ItemList)"/.test(ld)) score += 1;
  const about = [document.title, q('meta[property="og:site_name"]')?.content, q('meta[name="description"]')?.content].join(' ');
  if (NEWS_WORDS.test(about)) score += 1;
  publication = score >= 2;
  return publication;
}
const registrable = h => { const p = h.split('.'); return (p.length > 2 && /^(co|com|org|net|gov|ac|edu)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? p.slice(-3) : p.slice(-2)).join('.'); };
const SKIP_CONTAINERS = 'nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"]';
// aria-hidden marks duplicated carousel teasers (skip), but consent dialogs also hide the whole
// page behind them with it (keep: the teasers are real, just covered for now).
function skipLink(a) {
  if (a.closest(SKIP_CONTAINERS)) return true;
  const hidden = a.closest('[aria-hidden="true"]');
  return !!hidden && hidden.querySelectorAll('a[href]').length < 40;
}
