#!/usr/bin/env node
// Builds NoThis from src/. The engine (src/engine/*.js) is one program split into files by concern;
// they share one scope, so the build joins them in ENGINE order inside a single function:
//   - the extension's content script, dist/<target>/nothis.js, for chrome (also Edge), firefox and
//     safari, with a zip per target for store upload;
//   - the Declickbait userscript, ../declickbait.user.js, which also gets src/userscript/panel.js
//     (its in-page settings, since a userscript has no popup). That file is generated: edit src/.
// The version comes from package.json.
//
//   node build.mjs              everything
//   node build.mjs safari       one target (chrome, firefox, safari, userscript)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// Order matters only for code that runs while the script loads; everything else runs from main().
const ENGINE = ['config', 'hostkey', 'news-hosts', 'sites', 'calm-sites', 'rules', 'env', 'text', 'meta', 'reader', 'choose', 'page', 'topics', 'levels', 'plain', 'article', 'calm', 'settings'];
const USERSCRIPT_ONLY = ['userscript/panel'];
const read = name => name === 'news-hosts' ? newsList() : readFileSync(join(root, 'src', name.includes('/') ? name : `engine/${name}`) + '.js', 'utf8');
// src/engine/news-hosts.json (written by tools/news-hosts.mjs) becomes NEWS_LIST: each host's
// 7-character key (hostKey() in src/engine/hostkey.js), sorted and joined into one string, which
// sites.js binary-searches. Nothing is decoded when a page loads, and the list is about half the
// size of the host names. Read the JSON to see which hosts are on it.
function newsList() {
  const { generated, hosts } = JSON.parse(readFileSync(join(root, 'src', 'engine', 'news-hosts.json'), 'utf8'));
  const hostKey = new Function(read('hostkey') + '\nreturn hostKey;')();
  const keys = [...new Set(Object.values(hosts).flat().map(hostKey))].sort();
  return `// ───────────────────────────── Known news sites ─────────────────────────────
// Keys of the ${keys.length} hosts in src/engine/news-hosts.json (generated ${generated} by tools/news-hosts.mjs).
const NEWS_LIST = '${keys.join('')}';
`;
}
const indent = s => s.split('\n').map(l => (l ? '  ' + l : l)).join('\n');
// The engine waits for the page's HTML (and stylesheets) itself: the extension runs it at document_start (the manifest
// below), since DOMContentLoaded, when document_idle and document_end scripts run, also waits for every deferred script
// the site has: in WebKit 1.4 s after the HTML was parsed on nytimes.com and the Guardian. It starts once parsing is done
// and the stylesheets are in, because the layout says which headlines are big; a stuck stylesheet holds it up 1.5 s at most.
// A userscript manager runs it at document-idle, when the page is parsed already, so it starts at once there.
const WHEN_PARSED = `
let started = false;
const parsed = () => {
  if (started) return;
  globalThis.__wdMark?.(document.readyState === 'loading' ? 'early' : 'parsed');
  const wait = [...document.querySelectorAll('link[rel~="stylesheet"]')].filter(l => !l.sheet && !l.disabled && (!l.media || matchMedia(l.media).matches));
  let n = wait.length;
  const go = () => { if (!started) { started = true; start(); } };
  if (!n) return go();
  for (const l of wait) for (const ev of ['load', 'error']) l.addEventListener(ev, () => { if (--n <= 0) go(); }, { once: true });
  setTimeout(go, 1500);
};
if (globalThis.__wdStopped) parsed(); // gm-shim.js stopped a heavy page: there is nothing more to wait for
else if (document.readyState === 'loading') {
  document.addEventListener('readystatechange', parsed, { once: true });
  // A front page can have its headlines long before it is parsed: on nytimes.com the HTML was in after 0.5 s and parsed
  // after 4.3 s, held up by the site's own scripts. A front page (no article: at most two plain path segments) starts
  // once it has 60 links; plain view keeps reading the page as the rest comes in (harvest() in plain.js).
  let path = location.pathname; try { path = decodeURIComponent(path); } catch {}
  if (/^\\/(?:[\\p{L}-]{1,30}\\/?){0,2}$/u.test(path)) {
    const early = setInterval(() => {
      if (started || document.readyState !== 'loading') return clearInterval(early);
      if (document.body && document.links.length >= 60) { clearInterval(early); parsed(); }
    }, 100);
  }
}
else parsed();`;
const assemble = names => `(() => {\n  'use strict';\n  const start = () => {\n${[...names, 'boot'].map(n => indent(indent(read(n)))).join('\n')}\n    main().catch(e => { globalThis.__wdMark?.('error: ' + (e?.stack || e)); throw e; });\n  };\n${indent(WHEN_PARSED.trim())}\n})();\n`;

const USERSCRIPT_HEADER = `// ==UserScript==
// @name         Declickbait
// @namespace    no.sedb.declickbait
// @version      ${version}
// @description  Replaces clickbait teaser headlines with the article's own headline and lead, plus local cleanup rules. No API keys, no tracking.
// @author       Sindre Sørensen
// @license      MIT
// @homepageURL  https://github.com/Zindre/userscripts
// @supportURL   https://github.com/Zindre/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/Zindre/userscripts/main/declickbait.user.js
// @downloadURL  https://raw.githubusercontent.com/Zindre/userscripts/main/declickbait.user.js
// @mobile       true
// @match        *://*/*
// @noframes
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @connect      *
// ==/UserScript==
// Generated by extension/build.mjs from extension/src/ (the NoThis engine). Edit those files, not this one.

`;

const icons = sizes => Object.fromEntries(sizes.map(s => [s, `icons/icon-${s}.png`]));
const sites = ['http://*/*', 'https://*/*'];
const base = {
  manifest_version: 3,
  name: 'Web Detox',
  version,
  description: "News and social media without bait. For everyone, maybe especially useful with ADHD or autism. No tracking.",
  homepage_url: 'https://github.com/Zindre/userscripts',
  icons: icons([16, 32, 48, 96, 128, 256, 512]),
  action: { default_title: 'Web Detox', default_popup: 'popup.html', default_icon: icons([16, 19, 32, 38, 48]) },
  // declarativeNetRequest: background.js blocks the ads video players fetch before a video
  permissions: ['storage', 'declarativeNetRequest'],
  host_permissions: sites,
  // gm-shim.js runs before the page is drawn (it covers plain-view sites against a flash of the original); the engine
  // is loaded with it but starts once the HTML is parsed (WHEN_PARSED above). Both share the content script's scope.
  content_scripts: [{ matches: sites, js: ['gm-shim.js', 'nothis.js'], run_at: 'document_start' },
    // In the page's own world: Snapchat for Web on a phone (src/snapchat-web.js).
    { matches: ['https://www.snapchat.com/web*', 'https://snapchat.com/web*'], js: ['snapchat-web.js'], run_at: 'document_start', world: 'MAIN' }],
};
// App Store Connect refuses a Safari extension with a longer description, after the whole build.
if (base.description.length > 112) throw new Error(`description is ${base.description.length} characters; the limit is 112`);

const targets = {
  chrome: { ...base, background: { service_worker: 'background.js' } },
  firefox: {
    ...base,
    background: { scripts: ['background.js'] },
    browser_specific_settings: { gecko: { id: 'nothis@sedb.no', strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } },
  },
  // iOS only allows non-persistent background pages.
  // On an iPhone Safari didn't run the manifest's world: "MAIN" script in the page's world, so background.js registers it.
  safari: { ...base, permissions: [...base.permissions, 'scripting'], content_scripts: base.content_scripts.filter(c => !c.world),
    icons: icons([16, 32, 48, 96, 128, 256, 512, 1024]), background: { scripts: ['background.js'], persistent: false } },
};

// chrome-dev: the Chrome build in dist/chrome-dev/ for loading unpacked in your own Chrome (chrome://extensions, Load
// unpacked). It reloads itself within half a minute after each build, so new files only need a page reload. Built when
// asked for, and by a plain `node build.mjs` once the folder is there. Never zipped or published.
const DEV_RELOAD = `
// chrome-dev only (build.mjs): reload when build.mjs has written new files. The build's stamp is kept in session
// storage, which a reload clears, since the service worker sleeps between the checks.
const devStamp = () => fetch(chrome.runtime.getURL('stamp.txt'), { cache: 'no-store' }).then(r => r.ok ? r.text() : '').catch(() => '');
const devCheck = async () => {
  const now = await devStamp(); if (!now) return; // in the middle of a build
  const { devBuilt } = await chrome.storage.session.get('devBuilt');
  if (!devBuilt) await chrome.storage.session.set({ devBuilt: now });
  else if (devBuilt !== now) chrome.runtime.reload();
};
chrome.alarms.create('dev-reload', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'dev-reload') devCheck(); });
devCheck();
`;
const devDir = join(root, 'dist', 'chrome-dev');
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : [...Object.keys(targets), 'userscript', ...(existsSync(devDir) ? ['chrome-dev'] : [])];
for (const t of wanted) {
  if (t === 'chrome-dev') {
    const tmp = join(root, 'dist', '.chrome-dev-tmp');
    rmSync(tmp, { recursive: true, force: true });
    execFileSync(process.execPath, [fileURLToPath(import.meta.url), 'chrome'], { stdio: 'ignore' });
    cpSync(join(root, 'dist', 'chrome'), tmp, { recursive: true });
    writeFileSync(join(tmp, 'manifest.json'), JSON.stringify({ ...targets.chrome, name: 'Web Detox (dev)', permissions: [...targets.chrome.permissions, 'alarms'] }, null, 2) + '\n');
    writeFileSync(join(tmp, 'background.js'), readFileSync(join(tmp, 'background.js'), 'utf8') + DEV_RELOAD);
    // Files are replaced one by one, not the folder, so Chrome never finds it gone; the stamp is written last.
    mkdirSync(devDir, { recursive: true });
    rmSync(join(devDir, 'stamp.txt'), { force: true });
    cpSync(tmp, devDir, { recursive: true });
    rmSync(tmp, { recursive: true, force: true });
    writeFileSync(join(devDir, 'stamp.txt'), String(Date.now()));
    console.log('chrome-dev: dist/chrome-dev/ (reloads itself in Chrome within 30 s)');
    continue;
  }
  if (t === 'userscript') {
    writeFileSync(join(root, '..', 'declickbait.user.js'), USERSCRIPT_HEADER + assemble([...ENGINE, ...USERSCRIPT_ONLY]));
    console.log('userscript: ../declickbait.user.js');
    continue;
  }
  if (!targets[t]) throw new Error(`unknown target ${t}; use ${[...Object.keys(targets), 'userscript', 'chrome-dev'].join(', ')}`);
  const out = join(root, 'dist', t);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const skip = new Set(['engine', 'userscript'].map(d => join(root, 'src', d)));
  cpSync(join(root, 'src'), out, { recursive: true, filter: f => !f.endsWith('.svg') && !skip.has(f) });
  writeFileSync(join(out, 'nothis.js'), assemble(ENGINE));
  // gm-shim.js covers known news sites and calms the calm sites before they are drawn, so it gets
  // both lists too.
  let shim = readFileSync(join(out, 'gm-shim.js'), 'utf8');
  for (const [tag, names] of [['news-list', ['hostkey', 'news-hosts']], ['calm-sites', ['calm-sites']]]) {
    if (!shim.includes(`// @include ${tag}`)) throw new Error(`gm-shim.js: missing "// @include ${tag}"`);
    shim = shim.replace(`  // @include ${tag}`, () => indent(names.map(read).join('')).replace(/^  /, ''));
  }
  // WD_TIMING_URL=http://127.0.0.1:… node build.mjs safari: a build that sends each page's start-up times (gm-shim.js)
  // to a logger on this Mac, through the background page. Never for a build that is published.
  const timingUrl = /^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(process.env.WD_TIMING_URL || '') ? process.env.WD_TIMING_URL : '';
  shim = shim.replace("'@timing-url'", JSON.stringify(timingUrl));
  writeFileSync(join(out, 'gm-shim.js'), shim);
  if (timingUrl) writeFileSync(join(out, 'background.js'), readFileSync(join(out, 'background.js'), 'utf8') + `
// Timing build only (WD_TIMING_URL): start-up times from the content script, to a logger on this Mac.
api.runtime.onMessage.addListener(msg => {
  if (msg?.type === 'wd-timing' && msg.url === ${JSON.stringify(timingUrl)}) fetch(msg.url, { method: 'POST', body: JSON.stringify(msg.data) }).catch(() => {});
});
`);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(targets[t], null, 2) + '\n');
  const zip = join(root, 'dist', `nothis-${t}-${version}.zip`);
  rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', '-X', zip, '.'], { cwd: out });
  console.log(`${t}: dist/${t}/ and dist/nothis-${t}-${version}.zip`);
}

// The Safari Xcode project (safari/, from safari-web-extension-packager) references dist/safari/;
// keep its app version in step with the extension's.
const pbxproj = join(root, 'safari', 'NoThis', 'NoThis.xcodeproj', 'project.pbxproj');
if (wanted.includes('safari') && existsSync(pbxproj))
  writeFileSync(pbxproj, readFileSync(pbxproj, 'utf8').replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`));
