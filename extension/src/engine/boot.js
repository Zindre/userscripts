// ───────────────────────────── Boot ─────────────────────────────
// Runs last: reads the settings, hands them to the popup (extension) or the panel (userscript),
// then lays out plain view or starts rewriting the page.
async function main() {
  const disabled = (await gm.get('disabledHosts', [])) || [];
  const enabled = (await gm.get('enabledHosts', [])) || [];
  CFG.genericSites = await gm.get('genericSites', CFG.genericSites);
  hostEnabled = enabled.includes(host);
  const excluded = CFG.excludeHosts.some(h => h instanceof RegExp ? h.test(host) : host === h || host.endsWith('.' + h));
  let off = disabled.includes(host) || (!hostEnabled && (excluded || (!site && !CFG.genericSites)));
  // Reading level: per host, else the default (versions before 1.11 stored only includeLead).
  defaultLevel = await gm.get('level', (await gm.get('includeLead', true)) ? 'synopsis' : 'headlines');
  level = off ? 'vanilla' : ((await gm.get('siteLevels', {})) || {})[host] || defaultLevel;
  if (level === 'vanilla') off = true;
  hostOff = off;
  CFG.includeLead = level !== 'headlines';
  muted = new Set(((await gm.get('mutedTopics', [])) || []).filter(id => TOPICS[id]));
  CFG.display = await gm.get('display', CFG.display);
  let original = false; // the plain view's "Original" button: show the site as published, once
  try { original = sessionStorage.getItem('declickbait-original') === host; sessionStorage.removeItem('declickbait-original'); } catch {}
  // The extension's popup talks to settingsAction/settingsState; the userscript build has its own panel.
  if (EXT) GM.exposeSettings(async ({ act, arg } = {}) => { if (act) await settingsAction(act, arg); return settingsState(); });
  else if (typeof startPanel === 'function') startPanel(off, disabled);
  if (off) return; // settings still open here, so the site can be switched back on
  await loadCache();
  if (CFG.marker) {
    const st = document.createElement('style');
    st.textContent = '.cb-rewritten{box-shadow:inset 3px 0 0 0 rgba(40,160,90,.75);padding-left:.25em}.cb-stack{box-shadow:inset 3px 0 0 0 rgba(40,160,90,.35);padding-left:.25em}.cb-hint{background-image:repeating-linear-gradient(to bottom,rgba(40,160,90,.75) 0 5px,transparent 5px 9px);background-size:3px 100%;background-position:left top;background-repeat:no-repeat;padding-left:.25em}.cb-rewritten,.cb-rewritten *{white-space:normal!important;overflow-wrap:break-word;line-height:1.15}.cb-inline{text-decoration:underline dotted rgba(40,160,90,.9);text-underline-offset:.15em}.cb-btn{display:inline-block;margin-left:.35em;padding:0 .4em;font-size:.6em;line-height:1.6;vertical-align:middle;border-radius:.3em;background:rgba(40,160,90,.18);color:rgb(40,160,90);cursor:pointer;user-select:none;-webkit-user-select:none}.cb-reveal{display:block;margin:.3em 0;padding:.4em .6em;border-left:3px solid rgba(40,160,90,.75);background:rgba(40,160,90,.08);font-weight:normal;font-size:clamp(14px,.75em,20px);line-height:1.35;white-space:normal}.cb-reveal b{font-weight:600}.cb-reveal[hidden],.cb-lead[hidden]{display:none!important}.cb-lead{display:block;margin-top:.35em;font-weight:normal;font-size:clamp(14px,.6em,20px);line-height:1.3;opacity:.85}';
    document.head.appendChild(st);
  }
  if (muted.size) {
    const st = document.createElement('style');
    st.textContent = '.cb-muted{opacity:.08!important;filter:grayscale(1) blur(2px)!important;pointer-events:none!important}.cb-muted *{animation:none!important;transition:none!important}';
    document.head.appendChild(st);
  }
  if ((level === 'plain' || level === 'pictures') && !original) {
    if (!onArticlePage()) { if (await plainView(level === 'pictures')) return; }
    else calmArticle(level === 'pictures');
  }
  scan();
  let t;
  let last = 0;
  new MutationObserver(() => {
    if (document.hidden) return;
    clearTimeout(t);
    t = setTimeout(() => { last = Date.now(); if (related) calmArticle(related.withImages); scan(); }, Math.max(400, 1500 - (Date.now() - last)));
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', e => {
    const h = CFG.hotkey;
    // e.code is layout-independent: Option+Shift+U on a Mac produces a different e.key than "U".
    if ((e.code === 'Key' + h.key || e.key.toUpperCase() === h.key) && !!e.altKey === !!h.alt && !!e.shiftKey === !!h.shift) { e.preventDefault(); toggle(); }
  });
  try {
    if (typeof GM !== 'undefined' && GM.registerMenuCommand) {
      GM.registerMenuCommand('Declickbait: toggle original/rewritten', toggle);
    }
  } catch {}
}
