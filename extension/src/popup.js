// Toolbar popup: reads and changes the settings of the content script (the Declickbait userscript) in the
// active tab, through the handler the script registers with GM.exposeSettings (gm-shim.js).
'use strict';
const api = globalThis.browser ?? globalThis.chrome;
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ALL_SITES = { origins: ['http://*/*', 'https://*/*'] };
let tabId = null;
// The popup's texts in the browser's language (strings.js, from src/i18n/).
const T = stringsFor(api.i18n?.getUILanguage?.() || navigator.language), P = T.pop;
document.documentElement.lang = T.lang;
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = P[el.dataset.i18n];
for (const el of document.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', P[el.dataset.i18nLabel]);
// My news: the news sites you read most, together (mix.html), in a tab of its own.
$('my-news').textContent = T.myNews + ' →';
$('my-news').addEventListener('click', () => { api.tabs.create({ url: api.runtime.getURL('mix.html') }); window.close(); });

async function ask(msg = {}) {
  try {
    const s = await api.tabs.sendMessage(tabId, { type: 'declickbait-settings', ...msg });
    return s && !s.error ? s : null;
  } catch { return null; } // no content script in this tab
}

// The content script registers its handler once it has read its settings; give it a moment.
async function askUntil(ms) {
  const until = Date.now() + ms;
  for (;;) {
    const s = await ask();
    if (s || Date.now() > until) return s;
    await sleep(250);
  }
}

// level, display and generic reload the page: wait for it to start loading, then for the new page's script.
async function actAndReload(act, arg) {
  document.body.classList.add('busy');
  for (const el of document.querySelectorAll('input, button')) el.disabled = true;
  const loading = new Promise(resolve => {
    const done = () => { api.tabs.onUpdated.removeListener(onUpd); resolve(); };
    const onUpd = (id, info) => { if (id === tabId && info.status === 'loading') done(); };
    api.tabs.onUpdated.addListener(onUpd);
    setTimeout(done, 3000);
  });
  ask({ act, arg });
  await loading;
  await sleep(300);
  show(await askUntil(8000));
}

function show(s) {
  for (const el of document.querySelectorAll('input, button')) el.disabled = false;
  document.body.classList.remove('busy');
  $('settings').hidden = !s;
  $('unavailable').hidden = !!s;
  if (!s) return unavailable();
  $('host').textContent = s.host;
  const checked = s.fetches?.ok ? P.checked(s.fetches.ok) : '';
  const failed = s.fetches?.failed ? P.failed(s.fetches.failed) : '';
  const until = s.fetchPausedUntil && new Date(s.fetchPausedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const paused = until ? P.paused(s.host, until) : '';
  $('status').textContent = s.off ? P.asPublished(s.host)
    : s.calm ? P.calmStatus(s.calm, s.rewritten)
    : s.plain ? P.plainStatus(s.rewritten) + checked + failed + paused
    : ((s.level === 'plain' || s.level === 'pictures') && s.onArticle ? P.plainOnArticle : '')
      + (s.rewritten ? P.changed(s.rewritten) : P.noneFound) + checked + failed + paused;
  // A calm site (social media) has two levels, Vanilla and Calm; a news site the others.
  for (const r of document.querySelectorAll('input[name=level]')) {
    r.checked = r.value === s.level;
    // A site of the rest of the web (a shop, say) has Calm too, and the news levels for a news site we didn't know.
    r.closest('label').hidden = r.value === 'calm' ? !(s.calm || s.web) : !!s.calm && !s.web && r.value !== 'vanilla';
  }
  $('news-box').hidden = !!s.calm || !!s.web;
  document.querySelector('[data-i18n=calmDesc]').textContent = s.web ? P.webCalmDesc : P.calmDesc;
  document.querySelector('[data-i18n=calmHeading]').textContent = s.web ? P.webHeading : P.calmHeading;
  $('calm-box').hidden = s.off || !s.calmParts?.length;
  $('calm-parts').replaceChildren(...(s.calmParts || []).map(p => {
    const l = document.createElement('label'), t = document.createElement('span'), cb = document.createElement('input');
    l.className = 'switch'; t.textContent = T.part[p.id] || p.label; cb.type = 'checkbox'; cb.checked = p.show;
    cb.addEventListener('change', () => actAndReload('calmPart', [p.id, cb.checked]));
    l.append(t, cb);
    return l;
  }));
  const isDefault = s.level === s.defaultLevel;
  $('default').textContent = isDefault ? P.isDefault : P.makeDefault;
  $('default').disabled = isDefault;
  $('default').hidden = !!s.calm || !!s.web;
  // Headline style applies to the two rewriting levels, and to article pages under plain view.
  $('style-box').hidden = s.off || s.plain || !!s.calm || !!s.web;
  for (const r of document.querySelectorAll('input[name=display]')) r.checked = r.value === s.display;
  $('orig').checked = s.showOriginal;
  $('generic').checked = s.genericSites;
  $('swipe').checked = s.swipeAnimation !== false;
  $('big-pics').checked = !!s.bigPics;
  showAlbumApp(s.albumApp);

  // Topics the reader never wants, for all sites: main topics with their subtopics, from the
  // script's own tree. A muted main topic covers its subtopics, so they show as on and locked.
  const topics = $('topics'), muted = new Set(s.mutedTopics);
  topics.replaceChildren();
  const save = () => actAndReload('topics', [...topics.querySelectorAll('input:checked:not(:disabled)')].map(x => x.value));
  const topicBox = (id, label) => {
    const l = document.createElement('label'), cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = id; cb.checked = muted.has(id);
    cb.addEventListener('change', save);
    l.append(cb, label);
    return [l, cb];
  };
  for (const g of s.topics || []) {
    const row = document.createElement('div'), [gl, gcb] = topicBox(g.id, T.topic[g.id] || g.label);
    row.className = 'topic-row'; row.append(gl);
    if (g.children.length) {
      const kids = document.createElement('div'), more = document.createElement('button');
      kids.className = 'topic-children';
      const some = g.children.filter(c => muted.has(c.id)).length;
      kids.hidden = !some;
      more.type = 'button'; more.className = 'more';
      more.textContent = (some ? P.someOf(some, g.children.length) : `${g.children.length}`) + (kids.hidden ? ' ▸' : ' ▾');
      more.setAttribute('aria-label', P.subtopicsOf(T.topic[g.id] || g.label));
      more.addEventListener('click', () => { kids.hidden = !kids.hidden; more.textContent = more.textContent.replace(/[▸▾]$/, kids.hidden ? '▸' : '▾'); });
      for (const c of g.children) {
        const [cl, ccb] = topicBox(c.id, T.topic[c.id] || c.label);
        if (gcb.checked) { ccb.checked = true; ccb.disabled = true; }
        kids.append(cl);
      }
      gcb.indeterminate = !gcb.checked && some > 0;
      row.append(more);
      topics.append(row, kids);
    } else topics.append(row);
  }

  const box = $('changed');
  box.replaceChildren();
  for (const [list, label] of [['disabledHosts', P.disabledOn], ['enabledHosts', P.enabledOn]]) {
    if (!s[list].length) continue;
    const h3 = document.createElement('h3'); h3.textContent = label; box.append(h3);
    for (const h of s[list]) {
      const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = h;
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', P.remove(h));
      x.addEventListener('click', async () => show(await ask({ act: 'unset', arg: [list, h] })));
      chip.append(x); box.append(chip);
    }
  }
  box.hidden = !box.childElementCount;
}

async function unavailable() {
  const has = await api.permissions.contains(ALL_SITES).catch(() => true);
  $('grant').hidden = has;
}

$('grant').addEventListener('click', () => {
  // Firefox needs permissions.request directly inside the click, before any await.
  api.permissions.request(ALL_SITES).then(ok => { if (ok) { api.tabs.reload(tabId); window.close(); } });
});
for (const r of document.querySelectorAll('input[name=level]')) r.addEventListener('change', () => actAndReload('level', r.value));
for (const r of document.querySelectorAll('input[name=display]')) r.addEventListener('change', () => actAndReload('display', r.value));
$('default').addEventListener('click', async () => {
  const level = document.querySelector('input[name=level]:checked')?.value;
  if (level) show(await ask({ act: 'defaultLevel', arg: level }));
});
$('orig').addEventListener('change', async () => show(await ask({ act: 'orig' })));
$('generic').addEventListener('change', () => actAndReload('generic'));
$('big-pics').addEventListener('change', () => onMix ? setEverywhere('plainBigPics', $('big-pics').checked) : actAndReload('bigPics', $('big-pics').checked));
// My news is the extension's own page, where the popup can't ask a content script: the settings that apply everywhere
// (those of plain view), read and written in storage here, and the page reloaded.
let onMix = false;
async function showMix() {
  onMix = true;
  $('unavailable').hidden = true; $('settings').hidden = false;
  for (const el of $('settings').querySelectorAll(':scope > *, #news-box > *')) if (el.id !== 'news-box') el.hidden = !el.classList.contains('everywhere');
  const s = await api.storage.local.get(['swipeAnimation', 'plainBigPics', 'albumApp', 'kasetLinks']);
  $('swipe').checked = s.swipeAnimation !== false; $('big-pics').checked = !!s.plainBigPics;
  showAlbumApp(s.albumApp || (s.kasetLinks ? 'kaset' : ''));
}
// Which music app album reviews' ▶ button opens. Kaset is a Mac app: offered only there. The browser says which system
// it runs on (an iPad's Safari calls itself a Mac in navigator.platform).
function showAlbumApp(app) {
  $('album-app').value = app || '';
  (globalThis.browser ?? globalThis.chrome).runtime.getPlatformInfo().then(p => { if (p.os !== 'mac' && app !== 'kaset') $('kaset-opt')?.remove(); }, () => {});
}
const setEverywhere = async (key, value, reload = true) => { await api.storage.local.set({ [key]: value }); if (reload) api.tabs.reload(tabId).catch(() => {}); };
$('album-app').addEventListener('change', async () => {
  const v = $('album-app').value;
  if (onMix) { await api.storage.local.set({ kasetLinks: false }); setEverywhere('albumApp', v); } else actAndReload('albumApp', v);
});
$('swipe').addEventListener('change', async () => onMix ? setEverywhere('swipeAnimation', $('swipe').checked, false) : show(await ask({ act: 'swipeAnim', arg: $('swipe').checked })));

(async () => {
  $('version').textContent = 'v' + api.runtime.getManifest().version;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  if (tabId !== null && await api.runtime.sendMessage({ type: 'wd-mix-here', tabId }).catch(() => false)) return showMix();
  show(tabId === null ? null : await askUntil(1500));
})();

// A gift, for those who want to: one quiet link in the footer, nothing more (no reminders, no counting). Not in Safari:
// in an App Store app a gift has to go through Apple's in-app purchase, which this isn't yet. Empty GIFT_URL: no link.
const GIFT_URL = '';
if (GIFT_URL && !api.runtime.getManifest().permissions?.includes('nativeMessaging')) {
  $('gift').href = GIFT_URL; $('gift').textContent = P.gift; $('gift').hidden = false;
}

// Delete everything Web Detox has stored (background.js, wd-erase): asked once more first.
$('erase').addEventListener('click', () => { $('erase').hidden = true; $('erase-ask').hidden = false; $('erase-no').focus(); });
$('erase-no').addEventListener('click', () => { $('erase-ask').hidden = true; $('erase').hidden = false; });
$('erase-yes').addEventListener('click', async () => {
  for (const b of $('erase-ask').querySelectorAll('button')) b.disabled = true;
  const r = await api.runtime.sendMessage({ type: 'wd-erase' }).catch(() => null);
  $('erase-ask').hidden = true;
  $('erased').hidden = !r?.ok;
  $('erase').hidden = !!r?.ok;
  if (r?.ok && tabId) api.tabs.reload(tabId).catch(() => {});
});
