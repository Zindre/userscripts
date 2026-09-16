# Declickbait

Safari userscript (for [Userscripts.app](https://github.com/quoid/userscripts), macOS + iOS) that replaces clickbait teaser headlines with the linked article's own headline or lead paragraph. No API keys, no external services — it reads the metadata the article page already publishes.

## How it works

1. **Local rules** run immediately on every teaser: strips lead-in hooks ("Se videoen:", "Here's why:"), trailing bait ("– det skjedde"), `(VIDEO)` tags, `!!!`, `…`, emoji, and normalises SHOUTING CAPS (acronyms kept).
2. **Article metadata** is fetched for each teaser link (visible ones first, 3 at a time, cached 12 h): JSON-LD `headline`/`description`, `og:title`, `og:description`, `<h1>`, first paragraph.
3. **`auto` mode** picks the article headline if it scores less "baity" than the teaser, otherwise the description (truncated at a sentence boundary), otherwise the rules-cleaned teaser.
4. **Lead** (ingress) is shown under the headline in smaller, normal-weight text, unless it just repeats the headline.

Rewritten headlines get a thin green bar on the left; hover shows the original. **Alt+Shift+U** (or the Userscripts menu command) toggles all headlines between original and rewritten. The menu command **"Declickbait: toggle lead (ingress)"** turns the lead on/off and remembers the choice.

## Install

Open [declickbait.user.js](declickbait.user.js), press **Raw**, and your userscript manager offers to install it. In Safari with the Userscripts app, save the raw file into the app's script folder and open the popup once. Updates arrive through `@updateURL`; see the [README](README.md#updates).

Before you install, read the [disclaimers in the README](README.md#please-read-before-installing-declickbait). The short version: it can break page layouts, it fetches article pages in the background, and you can switch it off per site from the menu.

## Config

Everything is at the top of the file:

- `CFG.mode`: `auto` | `title` | `description`
- `CFG.fetch`: set `false` for rules-only (no requests)
- `CFG.includeLead`: show the article lead under the headline (default on; the menu toggle overrides and persists)
- `CFG.fitLines`: on tiles with fitted headline sizes (VG) the new text is sized to about this many lines
- `CFG.minTeaserLen`: shortest teaser to touch (default 8)
- `CFG.genericSites`: run on unlisted hosts using a generic article-URL heuristic
- `CFG.excludeHosts`: hosts the script never touches. The menu command **Declickbait: disable on \<host\>** does the same at runtime and remembers it.
- `SITES`: per-host article URL patterns. Included: VG, E24, BT, Aftenposten, BA, Dagbladet, NRK, TV 2, Nettavisen, DN (Norway); Aftonbladet, Expressen, SVT (Sweden); DR, Ekstra Bladet (Denmark); Bild, Spiegel, Welt (Germany); BBC, Guardian, Daily Mail, The Sun, Mirror, Independent, Telegraph (UK); CNN, NYT, Washington Post, NY Post, Fox News, HuffPost, BuzzFeed, Business Insider, AP, Reuters (US). Anything else goes through the generic heuristic when `CFG.genericSites` is on.
- `RULES`: ordered regex rewrites; `ACRONYMS`: caps words left untouched

## Limits

- Only as good as the site's own metadata; a tabloid whose `og:description` is also bait only gets the regex pass.
- YouTube is not handled (no useful metadata to fall back on).
- Sites that block cross-page fetches from the browser (bot-protection challenges, e.g. The Telegraph, AP, Reuters in testing) fall back to rules only.
- Rules and trigger words cover Norwegian, English, German, Swedish and Danish. Other languages get only the language-neutral cleanup (caps, punctuation, emoji, tags).
