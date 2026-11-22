// English: the source for every other language. A language file may leave a key out; English is used for it.
// The tone: plain, short and calm. No exclamation marks, no "please", no marketing words.
STRINGS.en = {
  // The list and the reader (plain view), in the language of the site being read.
  siteOrder: 'Site order', byImportance: 'Most important first', top: 'Top story', important: 'Important',
  related: 'Related articles', latest: 'Latest', other: 'Other', sections: 'Sections', original: 'Original', done: 'Done',
  paid: 'Subscription', count: n => `${n} ${n === 1 ? 'article' : 'articles'}`,
  editSections: 'Edit sections', editHint: 'Tap to hide or show, drag to move.',
  loading: 'Loading the article …', onSite: h => `Read on ${h}`, close: 'Close',
  paidHere: 'The rest of this article is for subscribers.', prev: 'Previous article', next: 'Next article',
  unreadable: "This article can't be shown here, but you can read it on the site.",
  playVideo: 'Play video',
  short: "That's all the text this article has. The site may have more, such as video or later updates.",
  hideRead: 'Hide read', readHidden: n => `${n} read ${n === 1 ? 'article' : 'articles'} hidden`, showRead: 'Show',
  later: 'Read later', marks: 'Bookmarks', mark: 'Bookmark', unLater: 'Remove from Read later', unMark: 'Remove bookmark',
  myNews: 'My news', mixEmpty: 'My news gathers the news sites you visit most. Visit a few, and they turn up here.',
  mixLoading: (n, of) => `Reading the front pages … ${n} of ${of}`,
  games: 'Games', allRead: 'You have read everything here.', showAllRead: 'Show read articles', siteMenu: 'The site’s menu', allGenres: 'All genres', genre: 'Genre', byScore: 'Highest score first', dateFrom: 'From', dateTo: 'To', playAlbumIn: 'Play the album in %s', kasetNone: 'Not found', recordLabel: 'Label', released: 'Released',
  keys: 'Arrow keys choose · Enter opens · ← → previous and next while reading · L read later · B bookmark · Esc closes',

  // The toolbar popup, in the browser's language.
  pop: {
    levelHeading: 'Reading level on this site', levelLabel: 'Reading level',
    vanilla: 'Vanilla', vanillaDesc: 'The site as published',
    headlines: 'Clear headlines', headlinesDesc: "Clickbait replaced with the article's own headline",
    synopsis: 'Clear headlines + synopsis', synopsisDesc: "Each headline with the article's lead",
    pictures: 'Plain view with images', picturesDesc: 'As plain view, with one image per article, all the same size',
    plain: 'Plain view', plainDesc: 'The articles in sections on a calm page. No ads, video or pop-ups',
    calm: 'Calm', calmDesc: 'What you follow, without ads, suggestions, short-video feeds or pop-ups that push the app',
    isDefault: '✓ Default for all sites', makeDefault: 'Use this level on all sites',
    calmHeading: 'Show on this site',
    // Calm on shops and other websites: the level's description, and the heading over its choices (they apply to all websites).
    webCalmDesc: 'The site without pressure to buy, sponsored products, pop-ups that ask for your e-mail, or videos that start by themselves',
    webHeading: 'Show on shops and other websites', neverHeading: 'Never show me', allSites: 'all sites',
    someOf: (n, of) => `${n} of ${of}`, subtopicsOf: g => `Subtopics of ${g}`,
    styleHeading: 'Headline style', styleRewrite: 'Rewrite', styleReveal: 'Reveal on tap', styleStack: 'Show both',
    showOriginal: 'Show original headlines', plainHeading: 'Plain view', swipe: 'Animate swiping between articles', albumApp: 'Play albums in', albumAppOff: 'Off',
    otherHeading: 'Other sites', generic: "Auto-detect news sites I haven't set up",
    disabledOn: 'Disabled on', enabledOn: 'Enabled on', remove: h => `Remove ${h}`,
    notRunning: "Web Detox isn't running on this page.",
    notRunningHint: 'It only runs on web pages, not on browser or store pages. If you just installed or allowed it, reload the page.',
    grant: 'Allow on all websites',
    // Status line at the top. n is a number; h a site such as nrk.no.
    asPublished: h => `Showing ${h} as published.`,
    calmStatus: (site, n) => `${site} without distractions: ` + (n ? `${n} ${n === 1 ? 'thing' : 'things'} hidden on this page.` : 'nothing to hide on this page yet.'),
    plainStatus: n => `Plain view: ${n} ${n === 1 ? 'article' : 'articles'}.`,
    plainOnArticle: 'Plain view is for front pages; this article shows clear headlines + synopsis. ',
    changed: n => `Changed ${n} ${n === 1 ? 'headline' : 'headlines'} on this page.`,
    noneFound: 'No clickbait headlines found on this page yet.',
    checked: n => ` Checked ${n} ${n === 1 ? 'article' : 'articles'}.`,
    failed: n => ` ${n} ${n === 1 ? 'article' : 'articles'} could not be loaded.`,
    paused: (h, time) => ` ${h} asked for a robot check, so Web Detox fetches no articles from it until ${time}.`,
    // Privacy, at the bottom of the popup.
    privacyHeading: 'Your data',
    privacyText: 'Your settings, saved articles and what you have read stay in this browser, and go to your other devices through your browser account or iCloud. Nothing is sent to us.',
    erase: 'Delete everything Web Detox has stored',
    eraseAsk: 'This deletes your settings, Read later, Bookmarks and reading history here, and on your other devices when they next sync. It can’t be undone.',
    reportOpen: "Report a problem with this site", reportHint: "One tap sends the page’s address and what is wrong, nothing about you.", reportNote: "Anything to add? (optional)", reportMissing: "Articles are missing from the list", reportReader: "An article shows wrongly or lacks content", reportMedia: "Pictures or video are missing", reportBroken: "The page looks odd or doesn’t work", reportOther: "Something else", reportFailed: "Couldn’t send just now. Try again later.", privacyReport: "The one exception is when you report a problem with a site: then the page’s address, what was wrong, anything you wrote, and the version of Web Detox are sent. Nothing about who you are.", reportThanks: h => `Thanks! Sent for ${h}.`,
    setupOpen: "Set up Web Detox with a few questions", setupLevel: "How do you want to see news front pages?", setupLevelHint: "For every news site where you haven’t chosen something else.", setupBigPics: "Larger pictures in the list?", setupGames: "The site’s games, like crosswords and sudoku, at the end of the list?", setupSwipe: "Should the article follow your finger when you swipe to the next one?", setupAlbum: "Where do you want to play albums from reviews?", setupAlbumHint: "Adds a ▶ button by each album review.", setupGeneric: "Should Web Detox also tidy news sites it doesn’t know yet?", yes: "Yes", no: "No", setupBack: "‹ Back", setupSkip: "Skip", setupDone: "Done. You can change all of this later here in the menu.", setupClose: "Close",
    gamesRow: 'The site’s games at the end of the list', bigPics: 'Larger pictures in the list',
    gift: 'Support Web Detox',
    eraseYes: 'Delete everything', eraseNo: 'Cancel', erased: 'Everything is deleted.',
  },

  // Topics in the popup's "Never show me".
  topic: {
    sport: 'Sport', football: 'Football', winter: 'Winter sports', motorsport: 'Motorsport', tennis: 'Tennis', golf: 'Golf',
    cycling: 'Cycling', handball: 'Handball', icehockey: 'Ice hockey', combat: 'Boxing and MMA', athletics: 'Athletics',
    ussports: 'US sports', esports: 'Esports', entertainment: 'Entertainment', reality: 'Reality TV', celebrity: 'Celebrities',
    royals: 'Royals', tvseries: 'TV and series', film: 'Film', music: 'Music', gaming: 'Gaming',
    incidents: 'Crime and accidents', crime: 'Crime', accidents: 'Accidents', obituaries: 'Death notices and obituaries',
    lifestyle: 'Lifestyle', health: 'Health and fitness', food: 'Food and drink', travel: 'Travel', home: 'Home and property',
    cars: 'Cars', fashion: 'Fashion and beauty', relationships: 'Sex and relationships', consumer: 'Consumer and shopping',
    opinion: 'Opinion and commentary', politics: 'Politics', business: 'Business and money', tech: 'Tech and science',
    weather: 'Weather',
  },

  // Parts of a social media site that can be shown or hidden (popup, "Show on this site").
  part: { birthdays: 'Birthdays', bait: 'Bait posts ("see the comments")',
    pressure: 'Pressure to buy now (countdowns, “only 2 left”)', sponsored: 'Sponsored products', suggested: '“You may also like” rows',
    offers: 'Pop-ups for newsletters, discounts and notifications', motion: 'Videos that start by themselves' },

  // The app's own page on iPhone, iPad and Mac, in the device's language.
  app: {
    iconAlt: 'Web Detox icon',
    intro: 'Two settings in Safari, both on the same page:',
    step1: 'Turn on Web Detox', step1Unknown: 'The switch at the top.', step1On: 'It’s on.', step1Off: 'It’s off: turn on the switch at the top.',
    step2: 'Allow it on all websites',
    step2Unknown: 'Under Permissions, set All Websites to Allow. Otherwise Safari asks on every site. Then open a website in Safari and come back here to check it.',
    step2On: 'It’s allowed on all websites.',
    step2Off: 'Now it only runs on the sites you allow one at a time. That’s fine if you prefer it. To use it everywhere, set All Websites to Allow under Permissions.',
    openSettings: 'Open Web Detox in Settings', path: 'Settings → Apps → Safari → Extensions → Web Detox',
    macUnknown: 'You can turn on Web Detox’s extension in the Extensions section of Safari Settings.',
    macOn: 'Web Detox’s extension is currently on. You can turn it off in the Extensions section of Safari Settings.',
    macOff: 'Web Detox’s extension is currently off. You can turn it on in the Extensions section of Safari Settings.',
    macOpen: 'Quit and Open Safari Settings…',
  },
};
