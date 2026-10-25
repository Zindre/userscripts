# Declickbait

Safari userscript (for [Userscripts.app](https://github.com/quoid/userscripts), macOS + iOS) that replaces clickbait teaser headlines with the linked article's own headline or lead paragraph. No API keys, no external services — it reads the metadata the article page already publishes.

## How it works

1. **Local rules** run immediately on every teaser: strips lead-in hooks ("Se videoen:", "Here's why:"), trailing bait ("– det skjedde"), `(VIDEO)` tags, `!!!`, `…`, emoji, and normalises SHOUTING CAPS (acronyms kept).
2. **Article metadata** is fetched for each teaser link (visible ones first, 3 at a time, cached 12 h): JSON-LD `headline`/`description`, `og:title`, `og:description`, `<h1>`, first paragraph.
3. **`auto` mode** picks the article headline if it scores less "baity" than the teaser, otherwise the description (truncated at a sentence boundary), otherwise the rules-cleaned teaser.
4. **Lead** (ingress) is shown under the headline in smaller, normal-weight text, unless it just repeats the headline.

**Reading levels.** Choose one per site in the settings panel, and make any of them the default for all other sites:

| Level | What you see |
|---|---|
| Vanilla | The site as published. The script does nothing there. |
| Clear headlines | Clickbait teasers replaced with the article's own headline. |
| Clear headlines + synopsis | The same, plus the article's lead under each headline. This is the default. |
| Plain view with images | As plain view, with one image per article on the right. Every image is cropped to the same size, and articles without one get a quiet grey frame, so the list stays even. The image is the teaser's own, else the article's share image. |
| Plain view | The site's front page swapped for a calm page: its articles grouped by section, headline and lead only. The site's own page is hidden, so ads, autoplay video, pop-ups and animation never show. A **Latest** section comes from the site's RSS feed. **Sections** lets you hide and reorder sections, remembered per site. **Original** shows the site as published, once. Paid articles are marked "Subscription" and open on the site as usual. Article pages are left alone and get clear headlines + synopsis. |

**Never show me.** In the settings panel (or the extension's popup) you can switch off topics you are never interested in, for all sites at once. Topics form a tree: switching off a main topic covers all its subtopics, or you pick single subtopics. Main topics: Sport (Football, Winter sports, Motorsport, Tennis, Golf, Cycling, Handball, Ice hockey, Boxing and MMA, Athletics, US sports, Esports), Entertainment (Reality TV, Celebrities, Royals, TV and series, Film, Music, Gaming), Crime and accidents, Death notices and obituaries, Lifestyle (Health and fitness, Food and drink, Travel, Home and property, Cars, Fashion and beauty, Sex and relationships, Consumer and shopping), Opinion and commentary, Politics, Business and money, Tech and science, and Weather. An article belongs to a topic when its URL has the topic's section (`/sport/`, `/rampelys/`), when the publisher's own section or keywords say so, or, for sport and reality, when the title names a league or a show (Eliteserien, Champions League, Skal vi danse, Farmen…). Plain view leaves these articles out; on the site itself their teasers are faded almost to nothing and can't be clicked, so the layout stays put and the bait stops pulling. Puzzles, quizzes, crosswords and horoscopes are always left out of plain view (`CFG.plainSkipGames`).

**Importance.** Before plain view takes over, the script notes how loudly the front page presents each teaser: headline size, how high up it sits and the size of its card. Plain view shows that as a quiet bar instead of big type: green for the top stories, grey for important ones. **Most important first** in the plain view header lists all articles in that order across sections; **Site order** goes back to sections. The choice is remembered.

**No flash of the original.** In the browser extension, a site that has had plain view before (or that you set to a plain level yourself) is covered with a calm background before it is drawn, and the cover lifts as soon as plain view is ready, so the original front page never flashes up. The userscript can't do this; it starts after the page has loaded.

**Article pages.** At the two plain view levels, blocks of teasers for other articles under or beside an article ("Les også", related, recommended) are hidden. Their articles are offered once, collapsed, as **Related articles** after the article, in the plain view style; leads are only fetched when you open it.

**Headline style** applies to the two clear-headline levels. `rewrite` (default) replaces the teaser text. `reveal` leaves every headline as it is: hovering shows the article's headline and lead as a tooltip, and a small green ▸ button after the headline opens the same text underneath on click or tap, which is what you use on a phone. `stack` also leaves the teaser on top but always shows the article's headline in bold and the lead right below it, so you see the bait and the answer together. `CFG.display` sets the default.

Why it works this way: see [extension/PURPOSE.md](extension/PURPOSE.md).

**Opening the settings panel.** The script adds no buttons to the page. You open the panel when you need it. All of these work on sites you have disabled too, so you can turn them back on:

- **Phone or tablet:** tap twice with two fingers, like a double tap but with two fingers side by side. Do it on an empty spot rather than on a link. Pinching and two-finger scrolling don't count.
- **Keyboard:** **Alt+Shift+D** opens the panel, and pressing it again closes it.
- **Address bar:** add `#declickbait` to the end of the address and press Enter. Or save `javascript:void(location.hash='declickbait')` as a bookmark in Favorites. On iPhone, tap the address bar and then that favourite.
- **Tampermonkey and Violentmonkey:** use **Declickbait: settings…** in the script menu, where the other actions are menu commands too. The Userscripts app on Safari has no script menu.

Close the panel with ✕ or Esc. It also lists the other sites you have disabled or enabled, and ✕ next to one undoes it.

The green bar on the left tells you what hover will show: a solid bar marks a rewritten headline whose tooltip is the original; a dashed bar marks an untouched headline in reveal mode whose tooltip is the expanded version. **Alt+Shift+U** (or the settings panel) toggles all headlines between original and rewritten; in reveal mode it opens or closes every reveal box, in stack mode it hides or shows every block.

## Install

Open [declickbait.user.js](declickbait.user.js), press **Raw**, and your userscript manager offers to install it. In Safari with the Userscripts app, save the raw file into the app's script folder and open the popup once. Updates arrive through `@updateURL`; see the [README](README.md#updates).

Before you install, read the [disclaimers in the README](README.md#please-read-before-installing-declickbait). The short version: it can break page layouts, it fetches article pages in the background, and you can switch it off per site from the menu.

## Config

The userscript is generated from the NoThis engine in [`extension/src/`](extension/README.md#how-the-code-is-laid-out): to change it, edit those files and run `node extension/build.mjs`. In an installed copy, the options are at the top of the script (`CFG`, in `extension/src/engine/config.js`):

- `CFG.mode`: `auto` | `title` | `description`
- `CFG.fetch`: set `false` for rules-only (no requests)
- `CFG.inlineLinks`: links inside running text (article bodies, "Les også:" lines) are never rewritten. `tooltip` (default) keeps the text and shows the article's headline and lead on hover, marked with a dotted underline; `rewrite` treats them like teasers; `off` leaves them alone.
- `CFG.fitLines`: on tiles with fitted headline sizes (VG) the new text is sized to about this many lines
- `CFG.minTeaserLen`: shortest teaser to touch (default 8)
- `CFG.genericSites`: run on unlisted hosts using a generic article-URL heuristic. It only activates on pages that score as a publication (two of: RSS/Atom feed, several `<article>` elements, news JSON-LD, article/frontpage `og:type`), and never on shops or cart/checkout/product pages. Set it to `false`, or use **Unlisted sites: only when enabled here** in the panel, and unlisted sites stay untouched until you choose a reading level for them there. UUIDs and id-like paths never count as article links.
- `CFG.excludeHosts`: hosts the script never touches. Choosing **Vanilla** for a site in the settings panel does the same at runtime and remembers it.
- `CFG.panelHotkey`: shortcut that opens and closes the panel (Alt+Shift+D); `CFG.panelGesture`: two-finger double tap opens it on touch screens.
- `SITES`: per-host article URL patterns. Included: VG, E24, BT, Aftenposten, BA, Dagbladet, NRK, TV 2, Nettavisen, DN (Norway); Aftonbladet, Expressen, SVT (Sweden); DR, Ekstra Bladet (Denmark); Bild, Spiegel, Welt (Germany); BBC, Guardian, Daily Mail, The Sun, Mirror, Independent, Telegraph (UK); CNN, NYT, Washington Post, NY Post, Fox News, HuffPost, BuzzFeed, Business Insider, AP, Reuters (US). Amedia's local papers (Nordlys, Romerikes Blad, Fædrelandsvennen and some 80 others) share BA's URL format and work through the generic heuristic. Anything else goes through the generic heuristic when `CFG.genericSites` is on.
- `LABELS`: badge and section labels stripped from the start of every teaser and fetched title ("Premium, ", "VG+, ", "Kommentar: "). Add a site's `strip` array in `SITES` for labels that only one host uses.
- `RULES`: ordered regex rewrites; `ACRONYMS`: caps words left untouched

## Limits

- Only as good as the site's own metadata; a tabloid whose `og:description` is also bait only gets the regex pass.
- YouTube is not handled (no useful metadata to fall back on).
- Sites that block cross-page fetches from the browser (bot-protection challenges, e.g. The Telegraph, AP, Reuters in testing) fall back to rules only.
- Rules and trigger words cover Norwegian, English, German, Swedish and Danish. Other languages get only the language-neutral cleanup (caps, punctuation, emoji, tags).
