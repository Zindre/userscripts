// ───────────────────────────── Calm sites ─────────────────────────────
// Sites that aren't news but are built to hold on to you, social media first. On these the reading
// level is just Calm or Vanilla. Calm keeps what you came for (the people, groups and channels you
// follow, search, messages, events) and hides what is there to keep you scrolling: ads, suggested
// posts and accounts, short-video feeds, trending boxes, and pop-ups that push you to the app or to
// log in. Opening the app stays your choice: an ordinary "Open app" button is left alone, but a site
// can't cover the page until you do, or send you to the app or the App Store by itself.
//
// One entry per site:
//   hide   CSS selectors hidden from the first paint (gm-shim.js puts them in before the page is drawn)
//   items  feed units to look at one by one (posts, cards, rows)
//   drop   an item is hidden when it contains one of these: a CSS selector string, or a RegExp tested
//          against the short labels in its first leaves (text or aria-label of 1-40 characters), so
//          "Sponsored" or "Suggested for you" in the post's header, not in what someone wrote
//   head   how many of an item's first leaf elements count as its header for drop's RegExps (default 40)
//   feed   for a feed without landmarks: marks a unit; the units are the children of the element that holds most of them
//   skip   leaves in these don't count as header (decoys)
//   label  where a unit's header says what it is, through aria-labelledby. It can arrive after the unit, so the unit
//          is looked at again until then; one with `unsure` in it stays away until the label has come, however
//          long that takes (Facebook: often half a minute), and a label inside `unsure` doesn't count
//   parts  boxes beside the feed: sel finds what marks one (with text, only if its text matches), and the box goes.
//          With an id and a label it is a choice in the settings instead, shown by default
//   within, heading  how far a part's box reaches: inside `within`, up to the next `heading`
//   notices  offers with no stable markup, found by their text: the nearest box with a button around
//          the text is hidden, and the layer it sits in if it covers the page
//   block  extra URL tests for redirects the page makes by itself: to the app through the site's own
//          URLs, or to a login wall (custom schemes and app stores always count)
//   unlock true when a wall in hide locks scrolling: scrolling is unlocked on that site from the start
// This file goes into gm-shim.js too (build.mjs), so it may only use plain data and the helpers below.
const CALM_SITES = [
  // Keeps posts from friends and your groups, events, birthdays and Messenger; drops sponsored and
  // suggested posts, Reels and Stories, and the Watch, Marketplace and Gaming tabs. The header of a
  // post you didn't ask for carries "Ad", "Suggested for you", or a Follow/Join button. "Ad" sits outside
  // the post (aria-labelledby), and each post starts with hidden decoys that say "Facebook".
  { name: 'Facebook', host: /(^|\.)facebook\.com$/,
    hide: [
      '[role="navigation"] a[href*="/watch"], [role="navigation"] a[href*="/marketplace"], [role="navigation"] a[href*="/gaming"], [role="navigation"] a[href*="/reel"]',
      '[role="banner"] a[href*="/watch"], [role="banner"] a[href*="/marketplace"], [role="banner"] a[href*="/gaming"], [role="banner"] a[href*="/reel"]',
      '[data-pagelet="Stories"], [aria-label="Stories" i][role="region"], [aria-label="Historier" i][role="region"]',
      '[aria-label="Reels" i][role="region"], [data-pagelet*="Reels"]',
    ],
    // www: the units of div[role=feed]; m.facebook.com: the tracked feed units.
    items: 'div[role="feed"] > div, [data-pagelet^="FeedUnit"], div[aria-posinset], div[data-tracking-duration-id]',
    feed: '[data-ad-rendering-role="profile_name"]', skip: '[aria-hidden="true"]',
    label: 'a span[aria-labelledby]', unsure: '[data-ad-rendering-role^="cta"]',
    within: '#right_rail_container, [role="complementary"]', heading: 'h2, h3',
    parts: [
      { sel: '#right_rail_container h3, [role="complementary"] h3', text: /^(?:Ad|Ads|Annonse|Annonser|Annons|Annonce|Reklame|Anzeige|Sponsored|Sponset|Sponsrad|Sponsoreret|Gesponsert)$/i },
      { id: 'birthdays', label: 'Birthdays', sel: '#right_rail_container a[href*="/events/birthdays"], [role="complementary"] a[href*="/events/birthdays"]' },
    ],
    drop: [
      'a[href*="/ads/about"], a[href*="ad_preferences"]',
      // The link where a post has its time and an ad has "Ad": on an ad it has no __tn__. It is there from the
      // start, where the word "Ad" can take half a minute, and an ad needs no button to be found by it.
      'a[href^="?__cft__"]:not([href*="__tn__"])',
      /^(?:Ad|Annonse|Annons|Annonce|Reklame|Anzeige|Werbung|Sponsored|Sponset|Sponsrad|Sponsoreret|Gesponsert)$/i,
      /^(?:Suggested for you|Foreslått for deg|Förslag för dig|Forslag til dig|Vorschläge für dich|Suggested groups|Foreslåtte grupper|People you may know|Personer du kanskje kjenner|Reels|Reels and short videos|Reels og korte videoer)$/i,
      /^(?:Follow|Følg|Följ|Folgen|Join|Join group|Bli med|Bli med i gruppen|Gå med i gruppen|Deltag|Beitreten)$/i,
    ] },
  { name: 'X', host: /(^|\.)(x|twitter)\.com$/,
    hide: [
      'aside[class~="fixed"]:has(a[href*="/i/jf/onboarding/"])',    // "See the whole profile / all replies – Continue to X" wall over the timeline
      '[data-interaction="app-store-obstruction"]',                 // mobile "Get the full app experience" sheet
      'button[class~="fixed"]:has(> img[src^="data:image/svg"])',   // floating "Scan to get the app" QR card
      '[data-testid="BottomBar"]',                                  // logged-out "Don't miss what's happening" bar (old UI)
      '[data-testid="sidebarColumn"] section:has([data-testid="trend"])',   // "What's happening" / trends (old UI)
      '[data-testid="sidebarColumn"] aside:has([data-testid="UserCell"])',  // "Who to follow" (old UI)
    ],
    items: '[data-testid="cellInnerDiv"], ul > li:has(> [role="link"][data-href*="/status/"])',
    drop: [/^(Ad|Promoted|Annonse|Reklame|Promotert|Annons|Sponsrad|Gesponsert|Anzeige|Werbung)$/,
      // the heading cell of "Who to follow" in the timeline (old UI)
      /^(Who to follow|Hvem du kan følge|Vem du kan följa|Hvem du skal følge|Wem folgen)$/],
  },
  { name: 'Reddit', host: /(^|\.)reddit\.com$/,
    hide: [
      'shreddit-ad-post', 'shreddit-sidebar-ad', 'shreddit-comments-page-ad', 'shreddit-comment-tree-ad',
      '[class*="configured-xpromo"]',                                // "Use the app" bottom sheet, full screen and floating bar
      'aside.right-rail-popular-communities',                        // "Popular communities"
      'aside:has(> pdp-right-rail)',                                 // "Related posts" beside a post
      'div[id^="t3_"][id$="_related"]',                              // "More posts you may like" under the comments on mobile
      'li:has(> faceplate-tracker > a[href="/r/popular/"])', 'li:has(> faceplate-tracker > a[href="/explore/"])',  // Popular and Explore in the menu
      '#siteTable > .promoted', '.side .spacer:has(> #ad_main)', '.trending-subreddits',  // old.reddit
    ],
    items: 'shreddit-post, article:has(> shreddit-post)',
    drop: [/^(Promoted|Sponsored|Annonse|Promotert|Sponset|Reklame|Sponsrad|Gesponsert|Anzeige)$/, '[promoted]'],
  },
  { name: 'LinkedIn', host: /(^|\.)linkedin\.com$/,
    hide: [
      '#base-contextual-sign-in-modal', '#public_post_contextual-sign-in',  // sign-in wall that opens by itself (the per-button ones stay)
      '.google-one-tap__module',                                     // its own "Sign in with Google" prompt
      '[data-test-id="similar-pages"]', 'section.browsemap',          // "Similar pages", "People also viewed"
      'section.related-posts', 'section.top-content-categories',     // "Explore more posts", "Explore content categories"
      '.feed-follows-module', '#feed-news-module', '.ad-banner-container',  // "Add to your feed", LinkedIn News, side ads (logged in)
      '[data-view-name*="pymk"]',                                    // "People you may know" (logged in)
    ],
    unlock: true,
    items: '.feed-shared-update-v2, [data-view-name="feed-full-update"]',
    drop: [/^(Promoted|Promotert|Sponset|Annonse|Sponsrad|Gesponsert|Anzeige|Suggested|Foreslått|Föreslaget|Foreslået|Vorgeschlagen)$/],
  },
  { name: 'Pinterest', host: /(^|\.)pinterest\.[a-z.]+$/,
    hide: [
      '[data-test-id="mobile-signup-mask"]', '[data-test-id="mobile-modal-mask-overlay"]',  // mobile "More ideas – just for you" app/sign-up wall
      '[data-test-id="fullPageSignupModal"]:has([data-nothis-calm="off"])',  // the dimmed backdrop left behind when the sign-up dialog was taken away
    ],
    unlock: true,
    items: '[data-grid-item="true"]',
    drop: [/^(Promoted|Promoted by|Sponset|Sponset av|Annonse|Reklame|Sponsrad|Gesponsert|Anzeige)$/],
  },
  { name: 'Quora', host: /(^|\.)quora\.com$/,
    hide: [
      '.spacing_log_question_page_ad', '[class*="dom_annotate_ad_"]',  // sponsored answers and image ads
      '.qu-borderAll:has(> .q-box > .q-flex > .dom_annotate_google_ad)',  // "Advertisement" boxes in the side column
      '.dom_annotate_related_questions',                               // "Related questions"
      '.qu-bg--blue.qu-height--60[style*="fixed"]',                    // mobile "Interested in …? Sign up" bar
    ],
    items: '.dom_annotate_question_answer_item, [class*="dom_annotate_multifeed_bundle"], .qu-borderAll.qu-boxShadow--small',  // answers, feed units, cards
    drop: [/^(Sponsored|Sponsored by|Promoted by|Ad by|Sponset|Annonse)$/, /^(Related questions|Relaterte spørsmål)$/],  // the second: "Related questions" cards between the answers
    head: 6,
  },
  { name: 'Threads', host: /(^|\.)threads\.(com|net)$/,
    hide: [
      // "Thread on Threads ... Open Threads": the pop-up that pushes the app over the page
      'body > div:has([role="dialog"] a[href*="applink.threads."]):not(:has(#scrollview))',
      // "Related threads" under a post's replies
      'div:has(> [data-pagelet*="related_posts"])',
    ],
    items: '[data-virtualized]',
    drop: [/^(Sponsored|Sponset|Sponsrad|Sponsoreret|Gesponsert|Suggested for you|Forslag til deg|Foreslått for deg|Förslag för dig|Forslag til dig|Vorschläge für dich)$/],
    head: 8 },
  { name: 'Bluesky', host: /(^|\.)bsky\.app$/,
    hide: [
      // the "Discover" feed tab, when it isn't the first tab (signed in, Following comes first)
      '[data-testid="homeScreenFeedTabs"] [role="tab"]:not([data-testid$="-selector-0"]):has([data-testid="homeScreenFeedTabs-Discover"])',
      // trending topics: pills in the sidebar, the feed and Explore, and the Trending feed
      'a[href^="/topic/"]', 'a[href^="/profile/trending.bsky.app/feed/"]',
    ],
    // feed rows, and the profile header's "Suggested for you" (it opens when you follow someone)
    items: '[data-list-row], [data-testid="profilePager"] > div > div',
    drop: ['a[href^="/topic/"]', /^(Suggested for you|Forslag til deg|Foreslått for deg|Förslag för dig|Forslag til dig|Vorschläge für dich|Für dich vorgeschlagen|Suggested (accounts|follows|feeds)|Trending( topics| videos)?|Trender|Trendar|Trends|Discover new feeds|Some other feeds you might like)$/i],
    head: 6 },
  { name: 'Tumblr', host: /(^|\.)tumblr\.com$/,
    hide: [
      // ads and "Top … blogs" / "Related communities" shelves in a timeline
      '[data-cell-id*="_ad"]:not([data-cell-id*="-post-"])', '[data-cell-id^="timelineObject:title"]', '[data-cell-id*="timelineObject:carousel"]',
      // sidebar "Check out these blogs" / "Trending Blogs"
      'aside > div:has(> ul > li)',
      // Explore in the menu, and the dashboard's "For you" tab
      'nav li:has(> a[href^="/explore"])', 'a[href="/dashboard/stuff_for_you"]',
      // the "Join over 100 million people …  Sign up / Log in" bar fixed over the bottom of the page
      'div:has(> div > div > strong ~ strong):has(> div > div > button ~ button)',
    ],
    items: '[data-cell-id], aside > div',
    drop: [/^(Sponsored|Sponset|Sponsrad|Sponsoreret|Gesponsert|Anzeige|Annonse|Blazed|Radar|Check out these blogs|Trending blogs)$/i],
    head: 4 },
  { name: 'Mastodon', host: /(^|\.)(mastodon\.(social|online|world|art|green|uno|scot|nu)|mstdn\.(social|jp)|mas\.to|fosstodon\.org|hachyderm\.io|infosec\.exchange|ioc\.exchange|techhub\.social|universeodon\.com|chaos\.social|social\.vivaldi\.net|toot\.community|masto\.ai|mastodonapp\.uk|aus\.social|norden\.social|snabelen\.no|troet\.cafe|det\.social|social\.tchncs\.de|sigmoid\.social|pawoo\.net)$/,
    hide: [
      // trending hashtags beside the navigation, and "Suggested follows" in the home timeline
      '.getting-started__trends', '.inline-follow-suggestions',
      // Explore's trending posts, hashtags, news and "For you" (its tabs link to /explore/tags); the search box above stays
      '.account__section-headline:has(> a[href="/explore/tags"])', '.account__section-headline:has(> a[href="/explore/tags"]) ~ *',
    ] },
  { name: 'VK', host: /(^|\.)vk\.(com|ru)$/,
    hide: [
      // logged out: "Follow the community's news … Sign up / Log in / Open in app" over the bottom, and the floating "Open in app"
      '[data-testid="unauthorized_banner"]', '[data-testid="mobile_open_in_native_app_float_btn"]',
      // the dimmed layer behind the "Sign up to browse …" pop-up (the generic code takes the pop-up itself)
      '.vkuiModalOverlay__host:has(+ .vkuiModalOutlet__host [data-testid="unauthorized_modal"])',
      // Clips (short videos): a community's Clips tab and the menu entry; the news feed's "Recommendations" tab
      '[data-testid="group_tab_short_videos"]', 'a[href="/clips"]', 'a[href*="section=recommended"]',
      // desktop: the ad under the left menu
      '#ads_left',
    ],
    items: '[data-testid="post"]',
    drop: [/^(Реклама|Рекламная запись|Ad|Advertising|Advertising post|Sponsored|Promoted|Reklame|Reklameinnlegg|Annonse|Sponset|Sponsrad|Werbung|Anzeige)$/i],
    head: 10 },
  // Web client: drops the Discover and "Download apps" buttons in the server bar, the Nitro, Shop and
  // Quests tabs above your DMs, and the gift button in the message box. Servers, DMs, friends,
  // notifications and settings stay. The site's own Discover pages (/servers, /discovery) are left
  // alone: you went there.
  { name: 'Discord', host: /(^|\.)discord\.com$/,
    hide: [
      // server bar: compass (Discover) and download buttons, and the list item around them
      '[data-list-item-id="guildsnav___guild-discover-button"], [data-list-item-id="guildsnav___app-download-button"]',
      '[class*="listItem"]:has(> * [data-list-item-id="guildsnav___guild-discover-button"], > * [data-list-item-id="guildsnav___app-download-button"])',
      // DM list: Nitro, Shop and Quests tabs
      'li:has(a[href="/store"], a[href="/shop"], a[href="/quest-home"], a[href^="/discovery/quests"]):not([id^="chat-messages"])',
      'a[href="/store"]:not([class*="markup"] a), a[href="/shop"]:not([class*="markup"] a), a[href="/quest-home"]:not([class*="markup"] a)',
      // gift (Nitro) button in the message box
      'button[aria-label="Send a gift"], button[aria-label="Send en gave"]',
    ] },

  // t.me and telegram.me: the channel and profile previews (t.me/s/name) are kept as they are. A t.me
  // link opens tg:// by itself (at once in a hidden frame, and on phones by a redirect 2 s later); the
  // redirect is cancelled by the generic guard. Telegram Web: sponsored messages at the end of big
  // channels (/k: bubble.is-sponsored, /a: SponsoredMessage) and sponsored chats in search.
  { name: 'Telegram', host: /(^|\.)(t|telegram)\.me$|^web\.telegram\.org$/,
    hide: [
      '.bubble.is-sponsored, .sponsored-peer-chip',
      '.SponsoredMessage',
    ] },

  // wa.me and api.whatsapp.com/send open whatsapp:// by themselves (a redirect on phones, a hidden
  // frame on a Mac); the redirect is cancelled by the generic guard, and the page's own "Open app"
  // and "Continue to WhatsApp Web" buttons stay. WhatsApp Web itself is chats and your contacts'
  // status updates, so nothing more is hidden there.
  { name: 'WhatsApp', host: /(^|\.)whatsapp\.com$|^wa\.me$/ },

  // Messenger is your chats and nothing else; only the generic app and login pop-ups and the redirect
  // guard apply. On a phone messenger.com is just a page to the App Store (there is no web chat).
  { name: 'Messenger', host: /(^|\.)messenger\.com$/ },

  // weibo.com and m.weibo.cn: drops the hot search lists (微博热搜) and the trending grid on the
  // search page, and ads in the feed. Logged out the whole home feed is 热门 (hot), so it stays.
  // A post you open no longer sends you to the login page when you scroll to more comments.
  { name: 'Weibo', host: /(^|\.)weibo\.(com|cn)$/,
    hide: [
      // desktop: hot search box in the right column, and its entry in the left menu
      '.hotBand, [role="link"][title="微博热搜"]',
      // desktop, logged out: the hot list and hot search categories under it in the left menu
      'a[href^="/newlogin?tabtype="]:not([href*="tabtype=weibo"])',
      // desktop, logged in: links to the hot pages (/hot/...) outside posts (unverified)
      'a[href^="/hot/"]:not(article a)',
      // m.weibo.cn search page before you type: hot search grid and the hot people / live row
      '.ntop-nav ~ .card16, .ntop-nav ~ .card11.ctype-3',
    ],
    // desktop: article in main; m.weibo.cn: one feed card
    items: 'main article, .wb-item-wrap',
    drop: [/^(广告|推广|热推|荐读)$/],
    // the comments list sends a logged-out reader to the login page (not a tap on "登录")
    block: [/^https:\/\/passport\.weibo\.(com|cn)\/sso\/signin\?.*source=wapssowb/] },
  { name: 'YouTube', host: /(^|\.)youtube\.com$/,
    hide: [
      // Shorts: guide entries, the mobile tab, shelves, single Shorts in results, a channel's Shorts tab
      'ytd-guide-entry-renderer:has(a[href^="/shorts"])', 'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
      'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
      'ytd-reel-shelf-renderer', 'ytm-reel-shelf-renderer', 'ytd-rich-shelf-renderer[is-shorts]',
      'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)', 'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
      'ytd-video-renderer:has(a[href^="/shorts/"])', 'ytm-video-with-context-renderer:has(a[href^="/shorts/"])',
      'yt-tab-shape[tab-title^="Shorts"]',
      // the home page's recommendation grid when logged out (desktop: a sign-in button; mobile: no Subscriptions tab)
      'ytd-app:has(#masthead #buttons a[href*="ServiceLogin"]) ytd-browse[page-subtype="home"] ytd-rich-item-renderer',
      'ytm-app:has(.pivot-w2w[aria-selected="true"]):not(:has(.pivot-subs)) ytm-rich-item-renderer',
      // watch page: "Up next" / related videos (playlist panel stays), end screen and end cards in the player
      'ytd-watch-flexy #related', 'ytm-item-section-renderer[section-identifier="related-items"]',
      '.ytp-endscreen-content', '.ytp-ce-element', '.ytp-autonav-endscreen-upnext-container', '.ytp-pause-overlay', '.ytp-suggestion-set',
      // Trending / Explore in the guide
      'ytd-guide-section-renderer:has(a[href^="/feed/trending"])', 'ytd-guide-entry-renderer:has(a[href^="/feed/explore"])',
      // ads: display ads, promoted videos, masthead ad, merch shelf, companion ads
      '#masthead-ad', '#player-ads', 'ytd-ad-slot-renderer', 'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)', 'ytd-in-feed-ad-layout-renderer',
      'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-video-renderer', 'ytd-banner-promo-renderer', 'ytd-statement-banner-renderer',
      'ytd-merch-shelf-renderer', 'ytd-companion-slot-renderer', 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
      'ad-slot-renderer', 'ytm-promoted-sparkles-web-renderer', 'ytm-promoted-video-renderer', 'ytm-companion-ad-renderer', 'ytm-rich-item-renderer:has(ad-slot-renderer)',
    ] },
  { name: 'Instagram', host: /(^|\.)instagram\.com$/,
    hide: [
      // Reels feed in the nav, an account's Reels tab, trending topics ("Popular") on Explore and in the footer
      'a[href^="/reels/"]', '[role="tablist"] > div:has(svg[aria-label="Reels"])', 'a[href^="/popular/"]',
      // mobile: "See this profile/post in the app" wall (the layer holding a dialog with an app link)
      'div:has(> div[tabindex="-1"] > div > div > [role="dialog"] a[href*="applink.instagram.com"])',
    ],
    // desktop sign-up walls with their backdrop (in a portal on profiles, inside <main> on posts),
    // and suggested accounts on profiles and Explore
    items: 'body > div:has(> div[data-interactable] [role="dialog"]), main > div:has([role="dialog"]), main > div > div > div',
    drop: [/^(See photos, videos and more from|Never miss a post from|Se bilder, videoer med mer fra|Gå aldri glipp av et innlegg fra|Se billeder, videoer og mere fra|Gå aldrig glip af et opslag fra|Se bilder, videor och mer från|Missa aldrig ett inlägg från|Sieh dir Fotos, Videos und mehr von|Verpasse keinen Beitrag mehr von) /,
      /^(Accounts you might like|Suggested for you|Profiles to keep an eye on|Kontoer du kanskje vil like|Foreslått for deg|Profiler du kan holde øye med|Konton som du kanske gillar|Förslag för dig|Konti, du måske kan lide|Forslag til dig|Konten, die dir gefallen könnten|Vorschläge für dich)$/] },
  { name: 'TikTok', host: /(^|\.)tiktok\.com$/,
    // The For You feed is the site itself, so only the walls go. The generic code takes the login
    // prompt that opens by itself; this is the "<name> is on TikTok – explore more in the app" modal
    // on profiles, whose text it doesn't recognise.
    items: '[class*="DivModalContainer"]',
    drop: ['[data-e2e="middle-cta-container"]'],
    block: [/^https?:\/\/(www\.)?tiktok\.com\/download(-link)?\//, /^https?:\/\/[^/]+\.tiktokv\.com\/redirect/] },
  { name: 'Snapchat', host: /(^|\.)snapchat\.com$/,
    hide: [
      // Spotlight and Discover ("Stories") in the top nav, the menu and the mobile tab bar; the home page's Spotlight tile
      'li:has(> a[href*="snapchat.com/spotlight"])', 'li:has(> a[href*="snapchat.com/discover"])', '[data-testid="video-slide-spotlight"]',
      // home page: "Popular right now" / "Watch funny videos" link lists
      '[data-testid="home-explore"]',
      // profiles: the Spotlight and Related tabs, "Recommended accounts"
      '[role="tab"]:has([data-testid="spotlight-section-heading-wrapper"])', '[role="tab"]:has([data-testid="related-section-heading-wrapper"])',
      '[class*="recommendedProfilesContainer"]',
      // mobile: "Snapchat is better on the app" sheet with its backdrop
      '[class*="mobileCustomFooterWrapper"]:has([data-testid="mobileExpandedCtaBanner"])',
    ],
    // Snapchat for Web: Team Snapchat's own chat in the list. The list places its rows itself, so the row leaves a gap.
    items: '[role="listitem"]',
    drop: [/^Team Snapchat$/i],
    head: 8,
    // Snapchat for Web: the offers to turn on notifications. Settings can still turn them on.
    notices: /(?:Varsler er deaktivert|Notifications are off|Tillat nettleseren å sende varsler|Allow your browser to send notifications|Aktiver varsler i dag|Enable notifications today|enabling browser notifications|ved å aktivere varsler)/i,
    block: [/^https?:\/\/click\.snapchat\.com\//],
    unlock: true }, // the app sheet locks scrolling
  { name: 'Twitch', host: /(^|\.)twitch\.tv$/,
    hide: [
      // front page: the autoplaying featured carousel and the recommendation shelves under it (the whole front page is recommendations)
      '[data-a-target="front-page-carousel"]', '[data-a-target="front-page-main-content"]',
      // side bar: recommended channels and "viewers also watch" (followed channels stay)
      '[role="group"]:has([data-test-selector="recommended-channel"])', '[role="group"]:has([data-test-selector="similarity-channel"])',
      // "Join the Twitch community" sign-up bar at the bottom
      'article:has(.tw-callout-message img[alt="CoolCat"])',
      // display ads around the player
      '[data-a-target="ads-banner"]', '.stream-display-ad__wrapper', '[data-test-selector="sda-wrapper"]',
    ] },
];

// Pop-ups that push the app, in the languages the extension is used in. Word edges are written as
// (?<!\p{L}) and (?!\p{L}), since \b doesn't count å, ö or ü as letters.
const APP_PUSH = /(?<!\p{L})(?:open|use|get|download|continue in|switch to|try) (?:in |on )?(?:the |our )?(?:\w+ )?app(?!\p{L})|(?<!\p{L})app (?:is )?(?:better|experience)|(?<!\p{L})better (?:on|in) the app(?!\p{L})|(?<!\p{L})på appen(?!\p{L})|(?<!\p{L})(?:åpne|bruk|fortsett i|last ned|hent|få) (?:i |inn i )?(?:\w+-)?app(?:en|likasjonen)?(?!\p{L})|(?<!\p{L})i (?:appen|applikasjonen)(?!\p{L})|(?<!\p{L})(?:öppna|använd|fortsätt i|hämta|ladda ner) (?:i )?app(?:en)?(?!\p{L})|(?<!\p{L})(?:åbn|brug|fortsæt i|hent) (?:i )?app(?:en)?(?!\p{L})|(?<!\p{L})(?:in der |in )?app (?:öffnen|nutzen|verwenden|holen|herunterladen)(?!\p{L})|(?<!\p{L})app-?\s*opplevelse/iu;
// Cookie and privacy choices are never taken away: they are yours to make.
const CONSENT = /(?<!\p{L})cookies?(?!\p{L})|informasjonskapsler|(?<!\p{L})samtykke|(?<!\p{L})consent(?!\p{L})|personvern|privacy (?:choices|settings)|kakor|datenschutz/iu;
const LOGIN_PUSH = /(?<!\p{L})(?:log ?in|sign ?in|sign up|create (?:an |new )?account|join \w+)(?!\p{L})|(?<!\p{L})(?:logg (?:deg )?inn|logg på|log på|registrer deg|opprett (?:en )?(?:ny )?konto)(?!\p{L})|(?<!\p{L})(?:logga in|skapa konto)(?!\p{L})|(?<!\p{L})(?:log ind|opret konto)(?!\p{L})|(?<!\p{L})(?:anmelden|einloggen|registrieren)(?!\p{L})/iu;

function calmStyle(s) {
  const st = document.createElement('style');
  st.id = 'nothis-calm';
  st.textContent = (s.hide?.length ? s.hide.join(',\n') + '{display:none!important}\n' : '') +
    // Google's "Sign in with Google" prompt, which many sites open by themselves.
    '#credential_picker_container,#credential_picker_iframe,' +
    '[data-nothis-calm="off"]{display:none!important}\n[data-nothis-calm="wait"]{visibility:hidden!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}\n' +
    // overflow visible, not auto, on body: a body of fixed height (React Native Web) would scroll on its own instead of the window
    'html[data-nothis-unlock]{overflow:auto!important}html[data-nothis-unlock]>body{overflow:visible!important;position:static!important}';
  return st;
}

// A redirect the page makes by itself (not a tap or click on a link) to the app or an app store is
// cancelled, while on() says the site is calm. Needs the Navigation API (Safari 26, Chrome 102,
// Firefox 147); without it nothing changes. WebKit doesn't mark a tapped link as userInitiated, so a
// navigation within a second of a real tap, click or key press counts as yours too.
function calmRedirects(s, on = () => true) {
  const toApp = u => !/^(?:https?|blob|data|about|javascript):$/.test(u.protocol) ||
    /^(?:apps|itunes)\.apple\.com$|^play\.google\.com$|^(?:app|link)\.adjust\.com$|\.app\.link$|\.onelink\.me$|^(?:www\.)?appsflyer\.com$/.test(u.hostname) ||
    (s.block || []).some(t => t.test(u.href));
  let tapped = 0;
  for (const ev of ['click', 'pointerup', 'touchend', 'keydown']) addEventListener(ev, e => { if (e.isTrusted) tapped = Date.now(); }, { capture: true, passive: true });
  try {
    window.navigation?.addEventListener('navigate', e => {
      if (!e.cancelable || e.userInitiated || Date.now() - tapped < 1000 || !on()) return;
      let u; try { u = new URL(e.destination.url); } catch { return; }
      if (toApp(u)) e.preventDefault();
    });
  } catch {}
  // An app launched from a hidden frame (t.me and wa.me on a Mac) is a frame that never loads.
  const frame = f => { try { if (f.tagName === 'IFRAME' && f.getAttribute('src') && on() && toApp(new URL(f.src, location.href))) f.remove(); } catch {} };
  // A site can ask for Safari's own app banner with this tag; taken out as the page is parsed. When the
  // app is installed and has claimed the site's URLs, Safari shows its banner anyway: no page can stop that.
  const BANNER = 'meta[name="apple-itunes-app"]';
  const banner = n => { if (on()) { if (n.matches(BANNER)) n.remove(); else n.querySelectorAll(BANNER).forEach(m => m.remove()); } };
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'attributes') frame(m.target);
      else for (const n of m.addedNodes) if (n.nodeType === 1) { frame(n); n.querySelectorAll?.('iframe[src]').forEach(frame); banner(n); }
    }
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}
