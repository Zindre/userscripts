# userscripts

Browser userscripts by Sindre Sørensen. They run in [Userscripts](https://github.com/quoid/userscripts) (Safari on macOS and iOS), [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/) and other managers that support the `GM.*` API.

| Script | What it does |
|---|---|
| [declickbait.user.js](declickbait.user.js) | Replaces clickbait teaser headlines on news front pages with the article's own headline and lead. It is built from the Web Detox engine and now lives in [Zindre/web-detox](https://github.com/Zindre/web-detox); the copy here only hands existing installs over to the new address. |
| [readable-fonts.user.js](readable-fonts.user.js) | Replaces body text fonts with Atkinson Hyperlegible Next on every site. Code stays monospace. |
| [bandcamp-volume.user.js](bandcamp-volume.user.js) | Adds a volume slider and seek bar to Bandcamp, with the volume remembered per site. |
| [google-yt-thumbs.user.js](google-yt-thumbs.user.js) | Sends clicks on YouTube thumbnails in Google results straight to the YouTube watch page instead of Google's inline player. |
| [yt-summary.user.js](yt-summary.user.js) | Adds a **Summarize** button to YouTube videos. It opens Claude or Gemini (your pick, remembered) in a new tab and sends a summary request. Claude gets the transcript; Gemini gets the link, since it can watch YouTube itself. It uses your normal logged-in chat, so you need no API key. Auto-summarize every video can be turned on from the userscript menu. |
| [tiktok-no-loop.user.js](tiktok-no-loop.user.js) | Stops TikTok videos from looping on tiktok.com. When a video ends it stays paused instead of playing again and again, which is handy if you fall asleep watching. Tap the video to watch it again. Works on iPhone with the Userscripts app. |
| [tiktok-no-app-prompt.user.js](tiktok-no-app-prompt.user.js) | Hides the "Get the full app experience / Open TikTok" dialog and the "Open app" button on the mobile tiktok.com feed, and stops TikTok from sending you to the App Store after a few videos. When TikTok would do that, the page reloads with new videos instead. It only reloads right after you swipe, never on its own. Needs Safari 26 or newer for the App Store part. |

## Install

1. Install a userscript manager. On Safari that is the Userscripts app. On Chrome, Firefox and Edge, Tampermonkey or Violentmonkey.
2. Click the `.user.js` file above, then the **Raw** button. The manager offers to install it.
3. Safari and Userscripts app: save the raw file into the folder you chose in the app, then open the Userscripts popup once so the app registers it.

## Updates

Every script carries `@updateURL` and `@downloadURL` pointing at this repository. Tampermonkey and Violentmonkey check for new versions automatically. The Userscripts app shows an update button in its popup when a newer version exists. If you install from Greasy Fork, it notifies you as well. To be told about every change, use **Watch → Custom → Releases** on this repository.

You use these scripts at your own risk. They are provided as-is under the MIT license, without any warranty. The author is not affiliated with any of the sites the scripts run on.

## Contributing

Bug reports and site patterns are welcome as issues or pull requests. For Declickbait, please open them in [Zindre/web-detox](https://github.com/Zindre/web-detox) instead; a new site usually needs one line in the `SITES` table: the host and a regular expression that matches its article URLs. Please include an example front-page link and the article URL it points to.

## License

[MIT](LICENSE)

---

### Norsk

Userscripts for Safari (Userscripts-appen på Mac og iPhone), Tampermonkey og Violentmonkey. Declickbait og nettleserutvidelsen Web Detox har flyttet til [Zindre/web-detox](https://github.com/Zindre/web-detox).
