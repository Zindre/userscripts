// Toolbar popup: reads and changes the settings of the content script (the Declickbait userscript) in the
// active tab, through the handler the script registers with GM.exposeSettings (gm-shim.js).
'use strict';
const api = globalThis.browser ?? globalThis.chrome;
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ALL_SITES = { origins: ['http://*/*', 'https://*/*'] };
let tabId = null;

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
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const checked = s.fetches?.ok ? ` Checked ${plural(s.fetches.ok, 'article')}.` : '';
  const failed = s.fetches?.failed ? ` ${plural(s.fetches.failed, 'article')} could not be loaded.` : '';
  $('status').textContent = s.off ? `Showing ${s.host} as published.`
    : s.plain ? `Plain view: ${plural(s.rewritten, 'article')}.` + checked + failed
    : ((s.level === 'plain' || s.level === 'pictures') && s.onArticle ? 'Plain view is for front pages; this article shows clear headlines + synopsis. ' : '')
      + (s.rewritten ? `Changed ${plural(s.rewritten, 'headline')} on this page.` : 'No clickbait headlines found on this page yet.') + checked + failed;
  for (const r of document.querySelectorAll('input[name=level]')) r.checked = r.value === s.level;
  const isDefault = s.level === s.defaultLevel;
  $('default').textContent = isDefault ? '✓ Default for all sites' : 'Use this level on all sites';
  $('default').disabled = isDefault;
  // Headline style applies to the two rewriting levels, and to article pages under plain view.
  $('style-box').hidden = s.off || s.plain;
  for (const r of document.querySelectorAll('input[name=display]')) r.checked = r.value === s.display;
  $('orig').checked = s.showOriginal;
  $('generic').checked = s.genericSites;

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
    const row = document.createElement('div'), [gl, gcb] = topicBox(g.id, g.label);
    row.className = 'topic-row'; row.append(gl);
    if (g.children.length) {
      const kids = document.createElement('div'), more = document.createElement('button');
      kids.className = 'topic-children';
      const some = g.children.filter(c => muted.has(c.id)).length;
      kids.hidden = !some;
      more.type = 'button'; more.className = 'more';
      more.textContent = (some ? `${some} of ${g.children.length}` : `${g.children.length}`) + (kids.hidden ? ' ▸' : ' ▾');
      more.setAttribute('aria-label', `Subtopics of ${g.label}`);
      more.addEventListener('click', () => { kids.hidden = !kids.hidden; more.textContent = more.textContent.replace(/[▸▾]$/, kids.hidden ? '▸' : '▾'); });
      for (const c of g.children) {
        const [cl, ccb] = topicBox(c.id, c.label);
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
  for (const [list, label] of [['disabledHosts', 'Disabled on'], ['enabledHosts', 'Enabled on']]) {
    if (!s[list].length) continue;
    const h3 = document.createElement('h3'); h3.textContent = label; box.append(h3);
    for (const h of s[list]) {
      const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = h;
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', `Remove ${h}`);
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

(async () => {
  $('version').textContent = 'v' + api.runtime.getManifest().version;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  show(tabId === null ? null : await askUntil(1500));
})();
