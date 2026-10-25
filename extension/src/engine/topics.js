// ───────────────────────────── Topics the reader never wants ─────────────────────────────
// Chosen once for all sites (mutedTopics). An article belongs to a topic when its URL has the
// topic's section (/sport/, /rampelys/), when the publisher's own section or keywords say so
// (article:section, JSON-LD articleSection/keywords), or for sport and reality when the title
// names a league or a show. Plain view leaves these articles out; on the site itself their
// teasers are faded out and made inert, so the layout stays and the bait stops pulling.
const TOPICS = {
  sport: { label: 'Sport',
    path: /^(?:sport|sporten|sports|sportbladet|sportmix|fotball|football|soccer|fussball|fußball|eliteserien|premier-league|champions-league|bundesliga|vintersport|alpint|langrenn|skiskyting|motorsport|formel-1|tennis|golf|handball|haandball|ishockey|hockey|nfl|nba|nhl|mlb|cricket|rugby|boksing|boxing|mma|ufc|sykling|cycling|friidrett|athletics|esport|tv-sporten)$/,
    label_re: /\b(?:sport\w*|fotball|football|soccer|fußball|fussball|tennis|golf|ishockey|hockey|langrenn|skiskyting|alpint|formel 1|motorsport|sykling|cycling|boksing|boxing|håndball|handball|friidrett|athletics)\b/i,
    title: /\b(?:eliteserien|obos-ligaen|toppserien|premier league|champions league|europa league|conference league|bundesliga|la liga|serie a|allsvenskan|superligaen|ballon d'or|skiskyting|langrenn)\b/i },
  reality: { label: 'Reality TV',
    path: /^(?:reality|realityserier|skal-vi-danse|farmen|farmen-kjendis|paradise-hotel|love-island|big-brother|kompani-lauritzen|ex-on-the-beach|bachelor|bachelorette|71-grader-nord|hver-gang-vi-motes|the-voice|idol|masterchef|lets-dance|dschungelcamp|robinson)$/,
    label_re: /\b(?:reality|realityserie\w*|skal vi danse|farmen|paradise hotel|love island)\b/i,
    title: /\b(?:skal vi danse|farmen|paradise hotel|love island|big brother|kompani lauritzen|ex on the beach|bachelor(?:ette)?|71° nord|hver gang vi møtes|the voice|masterchef|let's dance|strictly come dancing|i'm a celebrity|dschungelcamp|bauer sucht frau|germany's next topmodel|robinsonekspedisjonen|robinson|survivor|farmen kjendis)\b/i },
  celebrity: { label: 'Celebrities',
    path: /^(?:kjendis|kjendiser|rampelys|noje|nöje|underholdning|showbiz|celebrity|celebrities|unterhaltung|leute|promis?|stars|danske-kendte|kendte|tv-and-showbiz|tvshowbiz)$/,
    label_re: /\b(?:kjendis\w*|celebrit\w*|showbiz|underholdning|nöje|unterhaltung|promi\w*|leute|kendte)\b/i },
  royals: { label: 'Royals',
    path: /^(?:kongelige|kongehuset|royal|royals|royal-family|royale|kungligt|kungahuset|adel)$/,
    label_re: /\b(?:kongelig\w*|kongehus\w*|royal\w*|kunglig\w*|kungahus\w*)\b/i },
  crime: { label: 'Crime',
    path: /^(?:krim|crime|true-crime|kriminalitet|krimi|blaulicht|brott)$/,
    label_re: /\b(?:krim|crime|true crime|kriminalitet|blaulicht|brott)\b/i },
};
let muted = new Set();
function mutedTopicOf(url, teaser, meta) {
  if (!muted.size) return '';
  let segs = [];
  try { segs = new URL(url).pathname.toLowerCase().split('/').filter(Boolean).slice(0, -1); } catch {}
  const labels = [meta?.sec, ...(meta?.tags || [])].filter(Boolean).join(' | ');
  const words = [teaser, meta?.title].filter(Boolean).join(' | ');
  for (const id of muted) {
    const t = TOPICS[id];
    if (t && (segs.some(sg => t.path.test(sg)) || (labels && t.label_re.test(labels)) || (t.title && t.title.test(words)))) return id;
  }
  return '';
}
// Fade a teaser of a muted topic: its own <article> when that holds just this teaser, else the link.
function muteTeaser(a, topic) {
  const art = a.closest('article');
  const card = art && art.querySelectorAll('a[href]').length <= 4 ? art : a;
  card.classList.add('cb-muted'); card.dataset.cbTopic = topic;
  card.inert = true; card.setAttribute('aria-hidden', 'true');
}
