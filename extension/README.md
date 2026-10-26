# NoThis browser extension

NoThis is a Manifest V3 web extension for Safari (macOS and iOS), Chrome, Edge and Firefox. What it is for, and the principles behind it, are in [PURPOSE.md](PURPOSE.md).

Settings live in the toolbar popup: the reading level for the current site (Vanilla, Clear headlines, + synopsis, Plain view with images, Plain view), a default for all sites, the topics you never want, and the headline style. On iPhone the popup is under the page menu at the left of the address bar.

## How the code is laid out

The engine is one program split into files by concern under `src/engine/`. The files share one scope, and `build.mjs` joins them in order into a single script:

| File | What it holds |
|---|---|
| `config.js` | `CFG`: defaults and options |
| `sites.js` | Badge labels, the per-site URL patterns (`SITES`), generic article detection, publication detection |
| `rules.js` | Local rewrite rules, acronyms, bait words |
| `env.js` | This host, storage and fetching through the GM API |
| `text.js` | Cleanup, un-shouting, bait scoring, truncation |
| `meta.js` | Article metadata (headline, lead, image, section, keywords) and its cache |
| `choose.js` | Picking the clearest headline and lead |
| `page.js` | Rewriting teasers on the site itself, the fetch queue, scanning |
| `topics.js` | Never-show topics |
| `levels.js` | Reading levels |
| `plain.js` | Plain view: sections, images, importance, puzzles and ads left out, columns on wide screens, lazily filled front pages |
| `reader.js` | Reading an article in plain view: the article's text and pictures, nothing else, fetched ahead so it opens at once |
| `article.js` | Calm article pages and the related-articles list |
| `settings.js` | Reading and changing settings, for the popup and the panel |
| `boot.js` | `main()`: reads the settings and starts the right mode |

The engine talks to the browser through a small GM API. In the extension, `src/gm-shim.js` provides it. It runs before the page is drawn (`document_start`), the engine once the page has loaded (`document_idle`); on sites that get plain view it also covers the page so the original never flashes:

- **Storage:** `GM.getValue` and `GM.setValue` are backed by `storage.local`.
- **Fetching:** `GM.xmlHttpRequest` is answered by a fetch in `src/background.js`. In Manifest V3, only the background can read cross-site pages.
- **Settings:** `GM.exposeSettings` lets `src/popup.js` read and change the settings in the active tab.

The build also generates the Declickbait userscript, [`../declickbait.user.js`](../declickbait.md), for userscript managers (the Userscripts app in Safari, Tampermonkey, Violentmonkey). It is the same engine plus `src/userscript/panel.js`, an in-page settings panel, because a userscript has no popup. Never edit the generated file; CI checks that it matches the source.

## Build

```bash
node build.mjs
```

This writes `dist/chrome/`, `dist/firefox/` and `dist/safari/` with a zip of each for store upload, and regenerates `../declickbait.user.js`. The version comes from `package.json`. Rebuild after every change in `src/`, and commit the regenerated userscript with it.

## Load for testing

- **Chrome and Edge:** open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked** and pick `dist/chrome`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…** and pick `dist/firefox/manifest.json`. To check it for the add-on store, run `npx web-ext lint --source-dir dist/firefox`.
- **Safari on the Mac:** open `safari/NoThis/NoThis.xcodeproj`, choose the **NoThis (macOS)** scheme and run it. Then turn the extension on under Safari → Settings → Extensions.
- **Safari on iPhone or iPad:** choose the **NoThis (iOS)** scheme and run it on a simulator or a connected device. In Safari, open the page menu, choose **Manage Extensions** and turn NoThis on.

## TestFlight

The Xcode project in `safari/` was generated with `xcrun safari-web-extension-packager` and refers to `dist/safari/`. You never need to regenerate it. Updating the extension files is enough.

1. In [App Store Connect](https://appstoreconnect.apple.com), create an app with bundle ID `no.sedb.NoThis` for iOS and macOS.
2. Sign Xcode in to the developer account (Xcode → Settings → Accounts).
3. Run `safari/release.sh`. It builds, archives and uploads both platforms with a fresh build number.
4. In TestFlight, add yourself as an internal tester. Builds for internal testers need no review, but they expire after 90 days.

## GitHub Actions

[`.github/workflows/nothis.yml`](../.github/workflows/nothis.yml) runs on every push and pull request that touches the extension or the userscript. It checks the scripts, builds the Chrome/Edge and Firefox zips (downloadable from the run as the `nothis-zips` artifact) and lints the Firefox build.

A tag `nothis-v<version>` runs the whole chain: build and lint, then archive the iOS and macOS apps on GitHub's Xcode 27 image and upload them to TestFlight, then publish a GitHub release with the zips. The tag must match `version` in `package.json`:

```bash
git tag nothis-v1.12.0 && git push origin nothis-v1.12.0
```

### App Store Connect API key

Uploads use an App Store Connect API key instead of an Xcode login, both on GitHub and locally.

1. In App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys, generate a key with **Admin** access. Admin is needed so the runner can create its own signing certificate. Download the `.p8` file (it can only be downloaded once) and note the Key ID and the Issuer ID.
2. Keep the file at `~/.appstoreconnect/private_keys/AuthKey_<KEY ID>.p8`, the place Apple's tools look by default.
3. Store it as three repository secrets (run these yourself):

   ```bash
   gh secret set ASC_KEY_ID -R Zindre/userscripts
   ```
   ```bash
   gh secret set ASC_ISSUER_ID -R Zindre/userscripts
   ```
   ```bash
   gh secret set ASC_KEY_P8 -R Zindre/userscripts < ~/.appstoreconnect/private_keys/AuthKey_<KEY ID>.p8
   ```
4. For uploads from this Mac, create `safari/.asc.env` (git-ignored):

   ```bash
   ASC_KEY_ID=<KEY ID>
   ASC_ISSUER_ID=<ISSUER ID>
   ASC_KEY_PATH=$HOME/.appstoreconnect/private_keys/AuthKey_<KEY ID>.p8
   ```

`safari/release.sh` uses the key whenever these are set, and the Xcode account otherwise. Build numbers are the UTC time (`yymmddHHMM`), so local and GitHub uploads never collide.
