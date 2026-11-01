// ───────────────────────────── Calm sites: the page ─────────────────────────────
// Runs instead of the news engine on a site in CALM_SITES (calm-sites.js) at the Calm level: the
// site's hide list as a style sheet, feed items checked as they come in, and pop-ups that push the
// app or a login taken away again. Counts what it hid, for the popup.
let calmCount = 0;

function runCalm(s) {
  // Some sites swap out <head> or the whole <html> while they boot, so the sheet is put back when it goes.
  const sheet = () => { if (!document.getElementById('nothis-calm')) (document.head || document.documentElement).appendChild(calmStyle(s)); };
  sheet();
  // A login or app dialog the page opens by itself goes; one that follows your own tap or click stays.
  // Pressing a "Log in" or "Open app" button brings back the ones taken away, since sites reuse them.
  let tapped = 0;
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) addEventListener(ev, e => {
    tapped = Date.now();
    const b = e.target?.closest?.('a, button, [role="button"]'), t = (b?.textContent || b?.getAttribute('aria-label') || '').trim();
    if (t && t.length <= 40 && (LOGIN_PUSH.test(t) || APP_PUSH.test(t))) for (const l of document.querySelectorAll('[data-nothis-calm="off"][data-nothis-push]')) { l.dataset.nothisPush = 'yours'; delete l.dataset.nothisCalm; calmCount--; }
  }, { capture: true, passive: true });
  const off = el => { if (el.dataset.nothisCalm !== 'off') { el.dataset.nothisCalm = 'off'; calmCount++; } };
  if (s.unlock) document.documentElement.dataset.nothisUnlock = ''; // the site's own hide list takes a wall away

  const leaves = (el, n) => {
    const out = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    for (let e = walk.nextNode(); e && out.length < n; e = walk.nextNode()) {
      const al = e.getAttribute('aria-label');
      if (al && al.length <= 40) out.push(al.trim());
      // A label may be split into several elements (one per word, or per letter on Facebook).
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length <= 40 && (!e.childElementCount || !e.parentElement || (e.parentElement.textContent || '').trim().length > t.length)) out.push(t);
    }
    return out;
  };
  const dropped = it => (s.drop || []).some(d => typeof d === 'string' ? it.querySelector(d) : leaves(it, s.head || 40).some(t => d.test(t)));

  // The outermost fixed layer over most of the screen around el (the backdrop, not just the box), or
  // a fixed bar at the top or bottom; else a fixed layer like that inside el.
  const big = n => { const r = n.getBoundingClientRect(); return r.width * r.height > innerWidth * innerHeight * 0.4 || (r.width > innerWidth * 0.8 && r.height > 20 && r.height < innerHeight * 0.3); };
  const fixed = n => { const p = getComputedStyle(n).position; return p === 'fixed' || p === 'sticky'; };
  const layerOf = el => {
    let found = null;
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) if (fixed(n) && big(n)) found = n;
    if (found || fixed(el)) return found || el;
    const inside = [...el.querySelectorAll('div')].slice(0, 40).find(n => fixed(n) && big(n));
    if (inside) return inside;
    // A dialog in a layer that isn't fixed itself, beside a fixed backdrop without text (Instagram);
    // only a layer that holds little more than the dialog, never the page around it.
    const most = el.textContent.length * 1.5 + 200;
    for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement && n.textContent.length <= most; n = n.parentElement)
      if ([...n.children].some(c => !c.contains(el) && !c.textContent.trim() && fixed(c) && big(c))) return n;
    return null;
  };
  // A consent dialog is one you answer: it has an accept or reject button. A login wall's footer
  // that mentions cookies or privacy doesn't make it one.
  const CONSENT_BUTTON = /godta|aksepter|avvis|tillat|accept|reject|decline|refuse|allow|agree|only (?:essential|necessary)|nødvendige|acceptera|avvisa|tillåt|afvis|akzeptieren|ablehnen|zustimmen/i;
  const consent = (d, t) => CONSENT.test(t) && [...d.querySelectorAll('button, [role="button"], a')].some(b => CONSENT_BUTTON.test(b.textContent || ''));
  const pushes = () => {
    if (Date.now() - tapped < 2500) return;
    for (const d of document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], [class*="modal" i], [class*="banner" i], [id*="banner" i]')) {
      if (d.dataset.nothisCalm === 'off' || d.closest('[data-nothis-calm="off"], [data-nothis-push="yours"]')) continue;
      // innerText keeps blocks apart; textContent runs "i appen" and "Bruk appen" together
      const t = (d.innerText || d.textContent || '').slice(0, 2000);
      if (consent(d, t)) continue;
      const app = APP_PUSH.test(t), login = !app && LOGIN_PUSH.test(t) && d.querySelector('a, button, [role="button"], input');
      if (!app && !login) continue;
      const layer = layerOf(d);
      if (!layer || layer.dataset.nothisPush === 'yours') continue;
      layer.dataset.nothisPush = '';
      off(layer);
      // A dimmed backdrop beside it (no text of its own) goes with it.
      for (const sib of layer.parentElement?.children || []) if (sib !== layer && !sib.textContent.trim() && fixed(sib) && big(sib)) { sib.dataset.nothisPush = ''; off(sib); }
      // Sites lock scrolling behind their dialogs.
      document.documentElement.dataset.nothisUnlock = '';
    }
  };

  // A fixed bar that holds nothing but an "Open app" button (m.facebook.com when logged in). A bar
  // with more in it, like a header with the logo and "Log in", keeps its small button.
  const appBars = () => {
    for (const b of document.querySelectorAll('a, button, [role="button"]')) {
      const t = (b.textContent.trim() || b.getAttribute('aria-label') || '').trim();
      if (!t || t.length > 40 || !APP_PUSH.test(t) || b.closest('[data-nothis-calm="off"], [data-nothis-push="yours"]')) continue;
      let bar = b;
      while (bar && bar !== document.body && !fixed(bar)) bar = bar.parentElement;
      if (!bar || bar === document.body || bar.innerText.replace(/\s+/g, ' ').trim().length > t.length + 3) continue;
      bar.dataset.nothisPush = '';
      off(bar);
    }
  };

  const pass = () => {
    sheet();
    if (s.items) for (const it of document.querySelectorAll(s.items)) {
      // Feeds reuse their elements: look again when an item's text has changed.
      const len = String(it.textContent.length);
      if (it.dataset.nothisLen === len) continue;
      it.dataset.nothisLen = len;
      if (dropped(it)) { off(it); if (fixed(it) && big(it)) document.documentElement.dataset.nothisUnlock = ''; } // a wall in the feed
      else if (it.dataset.nothisCalm === 'off') { delete it.dataset.nothisCalm; calmCount--; }
    }
    pushes();
    appBars();
  };
  let queued = false;
  const later = () => { if (queued) return; queued = true; setTimeout(() => { queued = false; requestAnimationFrame(pass); }, 250); };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(later, 2000); // some sites reopen their dialogs without a DOM change we would see
  pass();
}
