// ───────────────────────────── Reading levels ─────────────────────────────
// vanilla   → the site as published (the host is in disabledHosts)
// headlines → clickbait headlines rewritten
// synopsis  → rewritten headlines plus the article's lead
// pictures  → plain view with one image per article, all cropped to the same size
// plain     → the site's articles on a calm page of our own (see Plain view)
// Chosen per host (siteLevels); the default for other hosts is stored as 'level'.
const LEVELS = ['vanilla', 'headlines', 'synopsis', 'pictures', 'plain'];
const LEVEL_NAMES = { vanilla: 'Vanilla: the site as published', headlines: 'Clear headlines', synopsis: 'Clear headlines + synopsis', pictures: 'Plain view with images', plain: 'Plain view: sections, no ads' };
let level = 'synopsis', defaultLevel = 'synopsis';

// Many front pages call themselves og:type=article (Express, NPR, FAZ, SZ, NDTV), so a page only
// counts as an article when its URL looks like one, or when og:type says so deeper than one section.
function onArticlePage() {
  const path = location.pathname;
  if (site ? site.article.test(path) : genericArticlePath(path)) return true;
  const og = document.querySelector('meta[property="og:type"]')?.getAttribute('content') || '';
  return /^article$/i.test(og) && path.split('/').filter(Boolean).length >= 2;
}
