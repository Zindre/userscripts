// ───────────────────────────── Topics the reader never wants ─────────────────────────────
// Chosen once for all sites (mutedTopics). Topics form a tree: main topics (Sport, Entertainment,
// Lifestyle, …) with subtopics (Football, Reality TV, Food, …). Muting a main topic mutes its
// subtopics too; a subtopic can also be muted on its own. An article belongs to a topic when its
// URL has the topic's section (path: /sport/, /rampelys/), when the publisher's own section or
// keywords say so (labels: article:section, JSON-LD articleSection/keywords), or, where names are
// unambiguous, when the title names a league or a show (title). Plain view leaves these articles
// out; on the site itself their teasers are faded out and made inert, so the layout stays and the
// bait stops pulling. Ids are stored, so keep them when relabelling.
const TOPICS = {
  sport: { label: 'Sport',
    path: /^(?:sport|sporten|sports|sportbladet|sportmix|tv-sporten|sportsnytt|sportnyheter)$/,
    labels: /\b(?:sport\w*|idrett\w*)\b/i },
  football: { parent: 'sport', label: 'Football',
    path: /^(?:fotball|football|soccer|fussball|fußball|eliteserien|obos-ligaen|toppserien|premier-league|champions-league|bundesliga|allsvenskan|superligaen)$/,
    labels: /\b(?:fotball|football|soccer|fußball|fussball)\b/i,
    title: /\b(?:eliteserien|obos-ligaen|toppserien|premier league|champions league|europa league|conference league|bundesliga|la liga|serie a|allsvenskan|superligaen|ballon d'or)\b/i },
  winter: { parent: 'sport', label: 'Winter sports',
    path: /^(?:vintersport|alpint|langrenn|skiskyting|skihopp|hopp|kombinert|skoyter|skøyter|wintersport)$/,
    labels: /\b(?:vintersport|langrenn|skiskyting|alpint|skihopp|skøyter|wintersport)\b/i,
    title: /\b(?:langrenn|skiskyting|skihopp|verdenscupen i (?:langrenn|skiskyting|alpint))\b/i },
  motorsport: { parent: 'sport', label: 'Motorsport',
    path: /^(?:motorsport|formel-1|formula-1|f1|rally|motogp)$/,
    labels: /\b(?:motorsport|formel 1|formula 1|rally|motogp)\b/i,
    title: /\b(?:formel 1|formula 1|motogp)\b/i },
  tennis: { parent: 'sport', label: 'Tennis', path: /^tennis$/, labels: /\btennis\b/i },
  golf: { parent: 'sport', label: 'Golf', path: /^golf$/, labels: /\bgolf\b/i },
  cycling: { parent: 'sport', label: 'Cycling', path: /^(?:sykling|cycling|radsport|tour-de-france)$/, labels: /\b(?:sykling|cycling|radsport)\b/i, title: /\btour de france\b/i },
  handball: { parent: 'sport', label: 'Handball', path: /^(?:handball|haandball|håndball|handbold)$/, labels: /\b(?:håndball|handball|handbold)\b/i },
  icehockey: { parent: 'sport', label: 'Ice hockey', path: /^(?:ishockey|hockey|nhl|eishockey)$/, labels: /\b(?:ishockey|ice hockey|eishockey|nhl)\b/i },
  combat: { parent: 'sport', label: 'Boxing and MMA', path: /^(?:boksing|boxing|boxen|mma|ufc|kampsport)$/, labels: /\b(?:boksing|boxing|boxen|mma|ufc|kampsport)\b/i },
  athletics: { parent: 'sport', label: 'Athletics', path: /^(?:friidrett|athletics|leichtathletik|friidraett)$/, labels: /\b(?:friidrett|athletics|leichtathletik)\b/i },
  ussports: { parent: 'sport', label: 'US sports', path: /^(?:nfl|nba|mlb|nhl|us-sport)$/, labels: /\b(?:nfl|nba|mlb|super bowl)\b/i, title: /\b(?:nfl|nba|super bowl)\b/i },
  esports: { parent: 'sport', label: 'Esports', path: /^(?:esport|esports|e-sport)$/, labels: /\be-?sports?\b/i },

  entertainment: { label: 'Entertainment',
    path: /^(?:underholdning|unterhaltung|entertainment|showbiz|noje|nöje|tv-and-showbiz|tvshowbiz)$/,
    labels: /\b(?:underholdning|entertainment|unterhaltung|showbiz|nöje)\b/i },
  reality: { parent: 'entertainment', label: 'Reality TV',
    path: /^(?:reality|realityserier|skal-vi-danse|farmen|farmen-kjendis|paradise-hotel|love-island|big-brother|kompani-lauritzen|ex-on-the-beach|bachelor|bachelorette|71-grader-nord|hver-gang-vi-motes|the-voice|idol|masterchef|lets-dance|dschungelcamp|robinson)$/,
    labels: /\b(?:reality|realityserie\w*|skal vi danse|farmen|paradise hotel|love island)\b/i,
    title: /\b(?:skal vi danse|farmen|paradise hotel|love island|big brother|kompani lauritzen|ex on the beach|bachelor(?:ette)?|71° nord|hver gang vi møtes|the voice|masterchef|let's dance|strictly come dancing|i'm a celebrity|dschungelcamp|bauer sucht frau|germany's next topmodel|robinsonekspedisjonen|robinson|survivor|farmen kjendis)\b/i },
  celebrity: { parent: 'entertainment', label: 'Celebrities',
    path: /^(?:kjendis|kjendiser|rampelys|celebrity|celebrities|leute|promis?|stars|danske-kendte|kendte)$/,
    labels: /\b(?:kjendis\w*|celebrit\w*|promi\w*|leute|kendte)\b/i },
  royals: { parent: 'entertainment', label: 'Royals',
    path: /^(?:kongelige|kongehuset|royal|royals|royal-family|royale|kungligt|kungahuset|adel)$/,
    labels: /\b(?:kongelig\w*|kongehus\w*|royal\w*|kunglig\w*|kungahus\w*)\b/i },
  tvseries: { parent: 'entertainment', label: 'TV and series',
    path: /^(?:tv|tv-og-serier|serier|tv-serier|streaming|tv-guide)$/,
    labels: /\b(?:tv-serie\w*|tv-program\w*|strømming|streaming)\b/i },
  film: { parent: 'entertainment', label: 'Film', path: /^(?:film|kino|movies|cinema)$/, labels: /\b(?:film|kino|movies?|cinema)\b/i },
  music: { parent: 'entertainment', label: 'Music', path: /^(?:musikk|music|musik|konsert)$/, labels: /\b(?:musikk|music|musik)\b/i },
  gaming: { parent: 'entertainment', label: 'Gaming', path: /^(?:gaming|dataspill|videospill|games|spill-og-gaming)$/, labels: /\b(?:gaming|dataspill|videospill|video games)\b/i },

  incidents: { label: 'Crime and accidents' },
  crime: { parent: 'incidents', label: 'Crime',
    path: /^(?:krim|crime|true-crime|kriminalitet|krimi|blaulicht|brott)$/,
    labels: /\b(?:krim|crime|true crime|kriminalitet|blaulicht|brott)\b/i },
  accidents: { parent: 'incidents', label: 'Accidents', path: /^(?:ulykker|ulykke|accidents|unfall|olyckor)$/, labels: /\b(?:ulykke\w*|trafikkulykke\w*|unfall|olycka\w*)\b/i },
  obituaries: { label: 'Death notices and obituaries',
    path: /^(?:dodsannonser|dødsannonser|doedsannonser|minnesider|minneside|minneord|nekrologer|nekrolog|obituaries|obituary|dodsannonser|dödsannonser|dodsfald|todesanzeigen|traueranzeigen|trauer)$/,
    labels: /\b(?:d[øo]dsannonse\w*|doedsannonse\w*|minneord|nekrolog\w*|obituar(?:y|ies)|dödsannons\w*|todesanzeige\w*|traueranzeige\w*)\b/i,
    title: /\b(?:d[øo]dsannonse\w*|doedsannonse\w*|dödsannons\w*|minneord|minnesider?|nekrolog\w*|obituar(?:y|ies)|todesanzeige\w*|traueranzeige\w*)\b/i },

  lifestyle: { label: 'Lifestyle', path: /^(?:livsstil|lifestyle|leben|living|life-and-style|life)$/, labels: /\b(?:livsstil|lifestyle)\b/i },
  health: { parent: 'lifestyle', label: 'Health and fitness', path: /^(?:helse|health|gesundheit|trening|fitness|halsa|hälsa)$/, labels: /\b(?:helse|health|gesundheit|trening|fitness|hälsa)\b/i },
  food: { parent: 'lifestyle', label: 'Food and drink', path: /^(?:mat|food|oppskrifter|recipes|mat-og-drikke|essen|drikke|vin|wine)$/, labels: /\b(?:mat|oppskrift\w*|food|recipes?|vin|wine)\b/i },
  travel: { parent: 'lifestyle', label: 'Travel', path: /^(?:reise|travel|reisen|resor)$/, labels: /\b(?:reise\w*|travel)\b/i },
  home: { parent: 'lifestyle', label: 'Home and property', path: /^(?:bolig|interior|interiør|interior-og-design|hjem|home|bolig-og-interior|wohnen|property|eiendom)$/, labels: /\b(?:bolig|interiør|eiendom|property|wohnen)\b/i },
  cars: { parent: 'lifestyle', label: 'Cars', path: /^(?:motor|bil|biler|cars|auto|bil-og-motor|broom|elbil)$/, labels: /\b(?:bil|biler|cars?|auto|elbil)\b/i },
  fashion: { parent: 'lifestyle', label: 'Fashion and beauty', path: /^(?:mote|skjonnhet|skjønnhet|fashion|beauty|style|mode|mote-og-skjonnhet)$/, labels: /\b(?:mote|skjønnhet|fashion|beauty)\b/i },
  relationships: { parent: 'lifestyle', label: 'Sex and relationships', path: /^(?:sex-og-samliv|samliv|relationships|parforhold|sex|dating)$/, labels: /\b(?:sex|samliv|parforhold|dating|relationships?)\b/i },
  consumer: { parent: 'lifestyle', label: 'Consumer and shopping', path: /^(?:forbruker|shopping|tilbud|deals)$/, labels: /\b(?:forbruker|shopping)\b/i },

  opinion: { label: 'Opinion and commentary',
    path: /^(?:meninger|debatt|kommentar|kommentarer|kronikk|leder|opinion|comment|commentisfree|ledare|debat|meinung|kommentare|synspunkter|voices|ideas)$/,
    labels: /\b(?:meninger|debatt|kommentar\w*|kronikk|leder|opinion|meinung|synspunkt\w*)\b/i },
  politics: { label: 'Politics', path: /^(?:politikk|politics|politik|valg|election|elections)$/, labels: /\b(?:politikk|politics|politik|valg\w*|elections?)\b/i },
  business: { label: 'Business and money',
    path: /^(?:okonomi|økonomi|business|money|penger|privatokonomi|privatøkonomi|naeringsliv|næringsliv|wirtschaft|finans|finance|markets|markeder|aktier|bors-og-finans)$/,
    labels: /\b(?:økonomi|business|finans|finance|næringsliv|privatøkonomi|wirtschaft|markets)\b/i },
  tech: { label: 'Tech and science', path: /^(?:teknologi|tech|technology|digital|vitenskap|science|wissen|forskning)$/, labels: /\b(?:teknologi|tech\w*|vitenskap|science|forskning|wissenschaft)\b/i },
  weather: { label: 'Weather', path: /^(?:vaer|vær|weather|wetter|vaersaker|værsaker)$/, labels: /\b(?:vær|weather|wetter|uvær)\b/i },
};
// Main topics with their subtopics, in TOPICS order: for the popup and the panel.
const TOPIC_TREE = Object.entries(TOPICS).filter(([, t]) => !t.parent)
  .map(([id, t]) => ({ id, label: t.label, children: Object.entries(TOPICS).filter(([, c]) => c.parent === id).map(([cid, c]) => ({ id: cid, label: c.label })) }));

let muted = new Set();
// The topics to match: each muted topic, and all subtopics of a muted main topic.
let mutedNodes = [];
function setMuted(ids) {
  muted = new Set(ids.filter(id => TOPICS[id]));
  const ids2 = new Set([...muted].flatMap(id => [id, ...Object.keys(TOPICS).filter(c => TOPICS[c].parent === id)]));
  mutedNodes = [...ids2].map(id => [id, TOPICS[id]]);
}
function mutedTopicOf(url, teaser, meta) {
  if (!mutedNodes.length) return '';
  let segs = [];
  try { segs = new URL(url).pathname.toLowerCase().split('/').filter(Boolean).slice(0, -1); } catch {}
  const labels = [meta?.sec, ...(meta?.tags || [])].filter(Boolean).join(' | ');
  const words = [teaser, meta?.title].filter(Boolean).join(' | ');
  for (const [id, t] of mutedNodes) {
    if ((t.path && segs.some(sg => t.path.test(sg))) || (t.labels && labels && t.labels.test(labels)) || (t.title && t.title.test(words))) return id;
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
