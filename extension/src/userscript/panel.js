// ───────────────────────────── Settings panel (userscript only) ─────────────────────────────
// The browser extension has its toolbar popup; a userscript has nowhere to put settings, and
// Userscripts.app (Safari) has no GM.registerMenuCommand either. So the userscript opens this
// panel on request: two-finger double tap, Alt+Shift+D, or #declickbait in the address (a
// bookmarklet can set it). Tampermonkey/Violentmonkey also get menu commands. Nothing of ours
// sits on the page until then.
const PANEL_HASH = '#declickbait';
let panelHost = null;
const panelOpen = () => !!panelHost && !panelHost.shadowRoot.querySelector('.box').hidden;
function openPanel() {
  if (panelHost) { panelHost.shadowRoot.querySelector('.box').hidden = false; listSites(); return; }
  panelHost = document.createElement('div');
  panelHost.id = 'declickbait-panel';
  const sh = panelHost.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>
    :host{all:initial;position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));z-index:2147483646;font:13px/1.35 -apple-system,system-ui,sans-serif;color:#111}
    @media (pointer: coarse){.box{width:min(280px,calc(100vw - 32px))}button{padding:10px 10px}}
    .box{position:absolute;right:0;bottom:0;width:250px;max-height:calc(100vh - 80px);overflow:auto;background:#fff;border:1px solid #cfd8d2;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);padding:10px 12px}
    .box[hidden]{display:none}
    h1{font-size:13px;margin:0 0 8px;color:#28a05a;display:flex;justify-content:space-between;align-items:center}
    h1 button.x{display:inline;width:auto;margin:0;padding:0 6px;border:0;background:none;font-size:16px;line-height:1;color:#888}
    .chip{display:inline-flex;align-items:center;gap:2px;margin:2px 4px 2px 0;padding:1px 2px 1px 6px;border:1px solid #d5d5d5;border-radius:10px;font-size:12px}
    .chip button{display:inline;width:auto;margin:0;padding:0 5px;border:0;background:none;color:#888}
    .row{margin:6px 0} .lbl{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px}
    button{display:block;width:100%;text-align:left;margin:2px 0;padding:6px 8px;border:1px solid #d5d5d5;border-radius:6px;background:#f7f7f7;font:inherit;cursor:pointer;color:#111}
    button:hover{background:#eef7f1;border-color:#28a05a} button.on{background:#e3f4ea;border-color:#28a05a;font-weight:600}
    .small{font-size:11px;color:#888;margin-top:8px}
  </style>
  <div class="box" hidden>
    <h1>Declickbait<button class="x" data-act="close" aria-label="Close">✕</button></h1>
    <div class="row"><div class="lbl">Reading level on ${host}</div>
      ${LEVELS.map(l => `<button data-level="${l}" class="${level === l ? 'on' : ''}">${LEVEL_NAMES[l]}</button>`).join('')}
      <button data-act="defaultLevel">${level === defaultLevel ? '✓ Default for all sites' : 'Use this level on all sites'}</button></div>
    <div class="row"><div class="lbl">Never show me (all sites)</div>
      ${Object.entries(TOPICS).map(([id, t]) => `<button data-topic="${id}" class="${muted.has(id) ? 'on' : ''}">${t.label}</button>`).join('')}</div>
    <div class="row"><div class="lbl">Headline style</div>
      <button data-mode="rewrite" class="${CFG.display === 'rewrite' ? 'on' : ''}">Rewrite headlines</button>
      <button data-mode="reveal" class="${CFG.display === 'reveal' ? 'on' : ''}">Keep headlines, reveal on hover/tap</button>
      <button data-mode="stack" class="${CFG.display === 'stack' ? 'on' : ''}">Keep headlines, show article headline + lead below</button></div>
    <div class="row"><div class="lbl">Options</div>
      <button data-act="orig">Toggle originals (Alt+Shift+U)</button>
      <button data-act="generic" class="${CFG.genericSites ? 'on' : ''}">Unlisted sites: ${CFG.genericSites ? 'auto-detect publications' : 'only when enabled here'}</button></div>
    <div class="row sites" hidden></div>
    <div class="small">v${(typeof GM !== 'undefined' && GM.info?.script?.version) || ''} · changing level or style reloads the page</div>
  </div>`;
  const box = sh.querySelector('.box');
  sh.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'close') closePanel();
    else if (b.dataset.unset) { await settingsAction('unset', b.dataset.unset.split(' ')); listSites(); }
    else if (b.dataset.mode) settingsAction('display', b.dataset.mode);
    else if (b.dataset.level) settingsAction('level', b.dataset.level);
    else if (b.dataset.topic) { const next = new Set(muted); next.has(b.dataset.topic) ? next.delete(b.dataset.topic) : next.add(b.dataset.topic); settingsAction('topics', [...next]); }
    else if (b.dataset.act === 'defaultLevel') { await settingsAction('defaultLevel', level); b.textContent = '✓ Default for all sites'; }
    else await settingsAction(b.dataset.act);
  });
  // In plain view the site's <body> is hidden, so the panel goes next to it.
  (plainHost ? document.documentElement : document.body || document.documentElement).appendChild(panelHost);
  box.hidden = false; listSites();
}
// Other hosts you have switched off or on by hand, so you can undo them from any page.
async function listSites() {
  const el = panelHost?.shadowRoot.querySelector('.sites'); if (!el) return;
  const lists = { disabledHosts: 'Disabled on', enabledHosts: 'Enabled on' };
  let html = '';
  for (const [list, label] of Object.entries(lists)) {
    const hosts = ((await gm.get(list, [])) || []).filter(h => h !== host);
    if (hosts.length) html += `<div class="lbl">${label}</div>` + hosts.map(h =>
      `<span class="chip">${h.replace(/[<>&"]/g, '')}<button data-unset="${list} ${h.replace(/[<>&" ]/g, '')}" aria-label="Remove">✕</button></span>`).join('');
  }
  el.innerHTML = html; el.hidden = !html;
}
function closePanel() {
  if (!panelHost) return;
  panelHost.shadowRoot.querySelector('.box').hidden = true;
  if (location.hash === PANEL_HASH) history.replaceState(history.state, '', location.href.replace(/#.*$/, ''));
}
const panelFromHash = () => { if (location.hash === PANEL_HASH) openPanel(); };
// Capture phase: some sites (VG) swallow Escape before it reaches document.
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && panelOpen()) { closePanel(); return; }
  const h = CFG.panelHotkey;
  if ((e.code === 'Key' + h.key || e.key.toUpperCase() === h.key) && !!e.altKey === !!h.alt && !!e.shiftKey === !!h.shift) { e.preventDefault(); panelOpen() ? closePanel() : openPanel(); }
}, true);
// Two-finger double tap: two fingers down and up without moving, twice within 400 ms.
// Pinch-zoom and two-finger scroll move, so they never count.
if (CFG.panelGesture) {
  let start = null, lastTap = 0;
  const opts = { passive: true, capture: true };
  window.addEventListener('touchstart', e => {
    if (e.touches.length === 2) start = { t: Date.now(), at: new Map([...e.touches].map(t => [t.identifier, [t.clientX, t.clientY]])) };
    else if (e.touches.length > 2) start = null;
  }, opts);
  window.addEventListener('touchmove', e => {
    if (start && [...e.touches].some(t => { const p = start.at.get(t.identifier); return !p || Math.hypot(t.clientX - p[0], t.clientY - p[1]) > 12; })) start = null;
  }, opts);
  window.addEventListener('touchcancel', () => { start = null; }, opts);
  window.addEventListener('touchend', e => {
    if (!start || e.touches.length) return; // wait until both fingers are up
    const quick = Date.now() - start.t < 350; start = null;
    if (!quick) { lastTap = 0; return; }
    const now = Date.now();
    if (now - lastTap < 400) { lastTap = 0; panelOpen() ? closePanel() : openPanel(); }
    else lastTap = now;
  }, opts);
}

// Called from main() once hostOff is known, so the panel offers the right level for this host.
function startPanel(off, disabled) {
  try {
    if (typeof GM !== 'undefined' && GM.registerMenuCommand) {
      GM.registerMenuCommand('Declickbait: settings…', openPanel);
      GM.registerMenuCommand(off ? 'Declickbait: enable on ' + host : 'Declickbait: disable on ' + host, async () => {
        const next = off ? disabled.filter(h => h !== host) : [...disabled, host];
        await gm.set('disabledHosts', next);
        location.reload();
      });
    }
  } catch {}
  window.addEventListener('hashchange', panelFromHash);
  panelFromHash();
}
