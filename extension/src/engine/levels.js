// ───────────────────────────── Reading levels ─────────────────────────────
// vanilla   → the site as published (the host is in disabledHosts)
// headlines → clickbait headlines rewritten
// synopsis  → rewritten headlines plus the article's lead
// pictures  → plain view with one image per article, all cropped to the same size
// plain     → the site's articles on a calm page of our own (see Plain view)
// calm      → on a calm site (calm-sites.js), the only level besides vanilla: without its distractions
// Chosen per host (siteLevels); the default for other hosts is stored as 'level'.
const LEVELS = ['vanilla', 'headlines', 'synopsis', 'pictures', 'plain'];
const LEVEL_NAMES = { vanilla: 'Vanilla: the site as published', headlines: 'Clear headlines', synopsis: 'Clear headlines + synopsis', pictures: 'Plain view with images', plain: 'Plain view: sections, no ads', calm: 'Calm: no ads, suggestions or app pop-ups' };
let level = 'pictures', defaultLevel = 'pictures';

// Many front pages call themselves og:type=article (Express, NPR, FAZ, SZ, NDTV), so a page only
// counts as an article when its URL looks like one, or when og:type says so deeper than one section, on a page that
// doesn't say it is a list: WordPress's archives (body class archive, category, …: Angry Metal Guy's
// /category/reviews/, musicOMH's /reviews/albums) and CollectionPage in the page's JSON-LD (NME's /reviews/album).
function onArticlePage() {
  const path = location.pathname;
  if (site?.article ? site.article.test(path) : genericArticlePath(path) || idQueryArticle(location)) return true;
  const og = document.querySelector('meta[property="og:type"]')?.getAttribute('content') || '';
  return /^article$/i.test(og) && path.split('/').filter(Boolean).length >= 2 && !listPage();
}
function listPage() {
  if (NOT_ARTICLE.test(location.pathname)) return true; // /category/…, /tag/…, /author/… (Stereogum's /category/reviews/album-of-the-week)
  if (/(?:^|\s)(?:archive|category|tag|tax-[\w-]+|post-type-archive|blog|home)(?:\s|$)/.test(document.body?.className || '')) return true;
  return [...document.querySelectorAll('script[type="application/ld+json"]')].some(s => /"@type"\s*:\s*"(?:CollectionPage|ItemList)"/.test(s.textContent) &&
    !/"@type"\s*:\s*"(?:NewsArticle|Article|BlogPosting|Review|ReportageNewsArticle)"/.test(s.textContent));
}
