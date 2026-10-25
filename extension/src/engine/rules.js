// ───────────────────────────── Rewrite rules ─────────────────────────────
// Local rewrite rules, applied in order. Edit freely.
const RULES = [
  // lead-in hooks:  "Se videoen: ..." / "Her er ..." / "Watch: ..." / "Schock: ..." / "Kolla: ..."
  [/^(?:se|sjekk|se videoen|se bildene|her er|dette er|dette skjer|nå|avslørt|avslører|sjokk|watch|look|video|pictured|in pictures|in photos|revealed|exclusive|breaking|just in|omg|wow|here'?s why|this is why|this is what|you won'?t believe|wait until you see|schock|unglaublich|so|hier|darum|deshalb|kolla|här är|därför|chock|sådan|derfor|se her|chok)\b[^:]{0,40}:\s*/i, ''],
  // trailing bait: "... – det skjedde" / "... - what happened next" / "... – was dann passierte"
  [/\s*[:–—-]\s*(?:det skjedde|se hva som skjedde|det som skjedde|resultatet|svaret overrasker|det er ikke det du tror|what happened next|the result|the answer|and it'?s not what you think|you'?ll be surprised|here'?s what happened|you need to see|the internet is|fans are losing it|everyone is saying|was dann passierte|das ergebnis|sie werden nicht glauben|det som hände|se resultatet|du kommer inte tro|se hvad der skete|det skete|du vil ikke tro)[^.]*$/i, ''],
  // parenthetical / bracketed teasers  "(VIDEO)" "[BILDER]" "(PHOTOS)"
  [/\s*[([](?:video|bilder|foto|se video|watch|photos?|pictures|gallery|pics|bildergalerie|bilder|billeder)[)\]]\s*/gi, ' '],
  // all-caps kicker before a lead: "BRÅK: Både president …"
  [/^[A-ZÆØÅÄÖÜ]{3,}:\s+(?=\S)/, ''],
  // stray entities in metadata ("&nbsp;")
  [/&(?:nbsp|#160);/g, ' '],
  // doubled quote dashes: "Navn: - - Sitat"
  [/(\s|:)[-–—]\s+[-–—]\s/g, '$1– '],
  // punctuation
  [/[!?]{2,}$/, m => m[0] === '?' ? '?' : ''],
  [/!$/, ''],
  [/\s*(?:…|\.{3})\s*$/, ''],
  [/^\s*[-–—•]\s*/, ''],
  // emoji / dingbats
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ''],
  [/\s{2,}/g, ' '],
];
// Caps words kept as-is when un-shouting. Add your own.
const ACRONYMS = new Set(['I', 'A', 'US', 'UK', 'EU', 'UN', 'FN', 'TV', 'AI', 'KI', 'PM', 'MP', 'MPs', 'CEO', 'NHS', 'FBI', 'CIA', 'NFL', 'NBA', 'MLB', 'NHL', 'NCAA', 'GOP', 'ISIS', 'IMF', 'WHO', 'NYC', 'LA', 'DC', 'NY', 'BBC', 'CNN', 'ABC', 'NBC', 'CBS', 'ESPN', 'HBO', 'ITV', 'NATO', 'UEFA', 'FIFA', 'NASA', 'COVID', 'OPEC', 'ASEAN', 'UNICEF', 'NASDAQ', 'GDPR', 'IKEA', 'BMW', 'VW', 'DNA', 'IQ', 'GPS', 'PDF', 'PC', 'iOS', 'MIT', 'UCLA', 'NOKAS', 'FHI', 'NHO', 'NRK', 'NAV', 'SSB', 'PST', 'USA', 'LO', 'UDI', 'UNE', 'NORAD', 'EM', 'VM', 'OL', 'SVT', 'SD', 'DR', 'DF', 'SF', 'AfD', 'CDU', 'CSU', 'SPD', 'FDP', 'DFB', 'ARD', 'ZDF', 'RTL', 'F1', 'MMA', 'UFC', 'WWE']);

// Words that point at the news instead of saying it ("Vance taler – så skjer dette", "Derfor gjør hun det").
const VAGUE_REFS = /\b(?:dette|disse|denne|slik|sånn|her er|derfor|grunnen|svaret|årsaken|hemmeligheten|this|these|here's|here is|that's why|the reason|the answer|the secret|what happened|dies|diese|darum|deshalb|der grund|so geht|detta|dessa|därför|så här|anledningen|grunden|sådan)\b/i;
const VAGUE_END = /\b(?:dette|disse|denne|slik|sånn|det|this|these|that|it|dies|das|detta|dessa)[.!?…]*$/i;
const VAGUE_OPENERS = /^(?:dette|denne|disse|derfor|slik|her|nå|hun|han|de|det|sånn|this|these|that|those|why|how|here|she|he|they|it|das|dies|diese|dieser|deshalb|darum|so|hier|er|sie|warum|wie|detta|därför|så här|hon|varför|hur|sådan|hvorfor|hvordan)\b/i;
const TRIGGERS = /\b(?:sjokk|sjokkert|rystet|ryster|avslør\w*|hemmelig\w*|utrolig|knalltøff|grep|reager\w*|raser|slakter|hyller|tabbe|advar\w*|bryter tausheten|shock\w*|stunn\w*|reveal\w*|secret|insane|unbelievable|jaw-dropping|slam\w*|blast\w*|rip\w* into|breaks silence|bombshell|brutal|savage|destroy\w*|meltdown|explosive|chilling|heartbreaking|hilarious|mind-blowing|game-changer|nightmare|horrifying|terrifying|devastating|outrag\w*|fury|furious|erupts?|goes viral|obsessed|must-see|epic fail|bizarre|weird|genius|crazy|schock\w*|skandal|krass|unfassbar|irre|wahnsinn|enthüllt|geheim\w*|eklat|wirbel|zoff|knallhart|chock\w*|hemlig\w*|rasar|sågar|hyllar|otrolig\w*|larm\w*|chok\w*|afslør\w*|sabler|hylder|skandale|kaos)\b/i;
