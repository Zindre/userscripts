# userscripts

Browser userscripts by Sindre Sørensen. They run in [Userscripts](https://github.com/quoid/userscripts) (Safari on macOS and iOS), [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/) and other managers that support the `GM.*` API.

| Script | What it does |
|---|---|
| [declickbait.user.js](declickbait.user.js) | Replaces clickbait teaser headlines on news front pages with the article's own headline and lead. Norwegian, Swedish, Danish, German, UK and US sites are covered explicitly; other sites use a generic heuristic. Details in [declickbait.md](declickbait.md). |
| [readable-fonts.user.js](readable-fonts.user.js) | Replaces body text fonts with Atkinson Hyperlegible Next on every site. Code stays monospace. |
| [bandcamp-volume.user.js](bandcamp-volume.user.js) | Adds a volume slider and seek bar to Bandcamp, with the volume remembered per site. |
| [google-yt-thumbs.user.js](google-yt-thumbs.user.js) | Sends clicks on YouTube thumbnails in Google results straight to the YouTube watch page instead of Google's inline player. |
| [yt-summary.user.js](yt-summary.user.js) | Adds a **Summarize** button to YouTube videos. It opens Claude or Gemini (your pick, remembered) in a new tab and sends a summary request. Claude gets the transcript; Gemini gets the link, since it can watch YouTube itself. It uses your normal logged-in chat, so you need no API key. Auto-summarize every video can be turned on from the userscript menu. |
| [tiktok-no-loop.user.js](tiktok-no-loop.user.js) | Stops TikTok videos from looping on tiktok.com. When a video ends it stays paused instead of playing again and again, which is handy if you fall asleep watching. Tap the video to watch it again. Works on iPhone with the Userscripts app. |
| [tiktok-no-app-prompt.user.js](tiktok-no-app-prompt.user.js) | Hides the "Get the full app experience / Open TikTok" dialog and the "Open app" button on the mobile tiktok.com feed, and stops TikTok from sending you to the App Store after a few videos. When TikTok would do that, the page reloads with new videos instead. It only reloads right after you swipe, never on its own. Needs Safari 26 or newer for the App Store part. |

## Declickbait: how it works, and why it does not use AI

Clickbait headlines withhold the one fact you came for. "Manager makes shock decision" links to an article whose own headline says exactly what was decided. Declickbait uses that: for every teaser on a front page it fetches the linked article once, reads the headline and lead the site already publishes for search engines and social media, and puts that text in place of the teaser. A local set of rules also strips the usual tricks: "Watch:", "You won't believe", ALL CAPS, trailing "…", emoji, `(VIDEO)` tags.

Rewriting headlines is an obvious job for a language model, and several browser extensions do it that way. They work, but each one needs an API key from an AI provider, and every headline costs a request, so you pay per page view and the extension stops working when the key expires or the quota runs out. Declickbait needs none of that. There is no account, no key and no bill. The article already contains the honest headline, so the script only has to go and get it. That makes it free to run, quick to set up, and it keeps working as long as sites keep publishing metadata.

The trade-off is candour, not quality: Declickbait can only show you what the site itself wrote. If the article's own headline is also bait, the script cannot invent a better one. See the disclaimers below before you install it.

## Install

1. Install a userscript manager. On Safari that is the Userscripts app. On Chrome, Firefox and Edge, Tampermonkey or Violentmonkey.
2. Click the `.user.js` file above, then the **Raw** button. The manager offers to install it.
3. Safari and Userscripts app: save the raw file into the folder you chose in the app, then open the Userscripts popup once so the app registers it.

## Updates

Every script carries `@updateURL` and `@downloadURL` pointing at this repository. Tampermonkey and Violentmonkey check for new versions automatically. The Userscripts app shows an update button in its popup when a newer version exists. If you install from Greasy Fork, it notifies you as well. To be told about every change, use **Watch → Custom → Releases** on this repository.

## Please read before installing Declickbait

Declickbait changes the pages you read and makes network requests on your behalf. Know what that means before you turn it on.

- **It can break pages.** The script rewrites headline elements on any site whose links look like articles. Sites change their markup without notice, and a rewrite that worked yesterday can push a layout out of shape today, hide a headline, or make a teaser unclickable. If a site misbehaves, open the settings panel (two-finger double tap on a phone, Alt+Shift+D on a computer, or add `#declickbait` to the address) and choose **Vanilla** for that site. That choice is remembered.
- **It fetches article pages in the background.** For each teaser it loads the linked article once, with at most three requests at a time, and caches the result for twelve hours. That costs bandwidth on mobile, shows up in the site's server logs as page views you never made, and on metered paywalls it may count against your monthly free articles.
- **Some sites will refuse.** Bot protection, rate limiting or consent walls can block the background requests. The script then falls back to its local cleanup rules only, and you may see very few rewrites on that site.
- **The rewrite is only as honest as the site's own metadata.** The script trusts the article's title and description tags. If those are themselves clickbait, so is the result.
- **It runs everywhere by default.** The `@match` is all sites. Add hosts to `CFG.excludeHosts`, disable sites from the settings panel, or narrow the match in your manager's settings if you prefer an allowlist.
- **No data leaves your browser.** There is no telemetry, no API key and no third-party service. The cache lives in your userscript manager's storage.

You use these scripts at your own risk. They are provided as-is under the MIT license, without any warranty. The author is not affiliated with any of the sites the scripts run on.

## Contributing

Bug reports and site patterns are welcome as issues or pull requests. For Declickbait, a new site usually needs one line in the `SITES` table: the host and a regular expression that matches its article URLs. Please include an example front-page link and the article URL it points to.

## License

[MIT](LICENSE)

---

### Norsk

Userscripts for Safari (Userscripts-appen på Mac og iPhone), Tampermonkey og Violentmonkey. Declickbait bytter ut klikkagn-titler på VG, Dagbladet, NRK, E24, Aftenposten og mange utenlandske forsider med artikkelens egen tittel og ingress. Les avsnittet «Please read before installing Declickbait» over før du installerer. Kort oppsummert: scriptet kan ødelegge layout på enkelte sider, det henter artikkelsider i bakgrunnen, og du kan slå det av per nettsted fra innstillingsknappen (den grønne D-en nederst til høyre).
