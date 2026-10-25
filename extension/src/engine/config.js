// ───────────────────────────── Config ─────────────────────────────
const CFG = {
  // 'auto'        → article <h1>/og:title if it is less baity than the teaser, else og:description
  // 'title'       → always the article's own headline
  // 'description' → always the article's lead/description
  mode: 'auto',
  // 'rewrite' → replace the teaser text.
  // 'reveal'  → leave headlines as they are: hover shows the article headline + lead as a tooltip, and a
  //             small green button after the headline opens the same text underneath on click or tap.
  // 'stack'   → leave the teaser on top, always show the article headline (bold) and lead underneath.
  // The menu command cycles through the three and remembers the choice.
  display: 'rewrite',
  fetch: true,             // fetch article pages for metadata (false = rules only)
  genericSites: true,      // run on hosts not listed in SITES when the page looks like a publication; false = only when you enable a site in the panel
  // Never run here. Strings match the host and its subdomains; regexes match the full host.
  // Search engines and web apps have no teasers to fix, and their pages churn constantly.
  excludeHosts: [/(^|\.)google\.[a-z.]+$/, 'bing.com', 'duckduckgo.com', 'youtube.com', 'youtu.be', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'reddit.com', 'github.com', 'mail.proton.me', 'outlook.live.com', 'office.com'],
  scanChunk: 150,          // anchors processed per slice before yielding to the page (keeps heavy pages responsive)
  maxFetchesPerPage: 60,
  concurrency: 3,
  cacheTtlMs: 12 * 3600e3,
  cacheMax: 2500,
  maxLen: 170,             // truncate descriptions at sentence boundary below this
  fitLines: 2.5,           // for tiles with fitted headline sizes (VG): size the new text to about this many lines
  includeLead: true,       // show the article lead under the headline; set from the reading level (see LEVELS)
  minTeaserLen: 8,
  marker: true,            // green left bar: solid = rewritten, hover shows the original; dashed = untouched, hover shows the expanded version
  plainSkipGames: true,    // plain view leaves out puzzles, quizzes, crosswords and horoscopes (BT's "Hjernetrim")
  inlineLinks: 'tooltip',  // links inside running text (article body, "Les også: …"): 'tooltip' keeps the text and
                           // shows headline + lead on hover; 'rewrite' treats them like teasers; 'off' ignores them
  hotkey: { key: 'U', alt: true, shift: true }, // Alt+Shift+U toggles original/rewritten
  panelHotkey: { key: 'D', alt: true, shift: true }, // userscript: Alt+Shift+D opens/closes the settings panel (also on disabled sites)
  panelGesture: true,      // userscript: two-finger double tap opens the settings panel on touch screens
};
