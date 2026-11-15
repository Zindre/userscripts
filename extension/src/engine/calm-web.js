// ───────────────────────────── Calm for the rest of the web ─────────────────────────────
// The same idea as on news and social media, for every other site, shops first: you see what you came for, without what
// is there to hurry you, interrupt you or keep you browsing. A site that is neither news (the news engine) nor one of
// CALM_SITES gets the Calm level here, unless you chose Vanilla for it. Nothing is tailored to a site: each part looks
// for a pattern, in the languages the extension is used in, and each can be switched back on in the popup (for all
// websites at once; calmParts['*']).
//
//   pressure   on shops: countdown clocks, "only 2 left", "14 people are looking at this", "selling fast"
//   sponsored  on shops: products in a list that are marked as paid placements
//   suggested  on shops: rows of "You may also like" and "Others also bought"
//   offers     everywhere: a pop-up the page opens by itself to get your e-mail address (newsletter, "10 % off your
//              first order", spin the wheel) or to ask for notifications. One that follows your own tap or click stays
//   motion     everywhere: silent videos without controls that start by themselves (backgrounds and banners)
//
// Cookie and privacy choices are never touched, nor anything on a checkout, cart, login or account page.
let webCalm = false, webSite = false; // webSite: this site would get it (also when it is switched off here)
const WEB_PARTS = [{ id: 'pressure', shop: true }, { id: 'sponsored', shop: true }, { id: 'suggested', shop: true }, { id: 'offers' }, { id: 'motion' }];

const WB = '(?<!\\p{L})', WE = '(?!\\p{L})';
// Hurry: scarcity, other people's activity and deadlines, in a short text of its own (a badge or a line, not a review).
const PRESSURE = new RegExp(WB + '(?:' + [
  // only N left
  '(?:only|just|kun|bare|endast|bara|nur noch|nur|nog maar|nog slechts|slechts|plus que|solo quedan|sólo quedan|quedan solo|ancora solo|solo)\\s+\\d+\\s+(?:left|igjen|kvar|tilbage|übrig|verfügbar|stück|op voorraad|over|en stock|restants?|disponibles?|rimasti|på lager|i lager|stk\\.? igjen)',
  '\\d+\\s+(?:left in stock|left at this price|igjen på lager|kvar i lager|tilbage på lager)',
  // other people, now
  '\\d+\\+?\\s+(?:people|others|shoppers|customers|personer|andre|kunder|andra|personen|andere|kunden|mensen|personnes|personas)\\s+(?:are |is |er |är |sehen |haben |hebben |ont |han )?(?:viewing|looking|watching|have (?:this )?in|bought|purchased|ser på|kikker på|har (?:denne |dette )?(?:i|kjøpt|købt|köpt)|tittar på|sich das an|gekauft|bekijken|gekocht|regardent|acheté|viendo|comprado)',
  '(?:bought|purchased|sold|viewed|kjøpt|solgt|sett|köpt|såld|købt|verkauft|gekauft|verkocht|vendus?|vendidos?)\\s+\\d+\\+?\\s*(?:times|ganger|gånger|gange|mal|keer|fois|veces)?\\s+(?:in the (?:last|past)|today|siste|i dag|senaste|idag|seneste|in den letzten|heute|vandaag|aujourd|hoy)',
  '\\d+\\+?\\s+(?:sold|bought|solgt|kjøpt|sålda|solgte|verkauft|verkocht)\\s+(?:in the (?:last|past)|today|siste|i dag|senaste|idag|seneste|in den letzten|heute|vandaag)',
  'in \\d+\\+? (?:carts|baskets|bags)|i \\d+\\+? (?:handlekurver|handlevogner|varukorgar|kurve)|in \\d+\\+? (?:warenkörben|winkelwagens)',
  // going fast
  '(?:selling|going) (?:out )?fast|almost (?:gone|sold out)|nearly sold out|in high demand|high demand|hurry[,!. ]|last chance|limited time (?:only|offer|deal)|while (?:stocks?|supplies) lasts?|don.t miss out',
  'selges raskt|går fort unna|nesten utsolgt|snart utsolgt|høy etterspørsel|stor etterspørsel|skynd deg|siste sjanse|tidsbegrenset tilbud|så lenge lageret rekker|ikke gå glipp',
  'säljs snabbt|snart slutsåld|nästan slutsåld|hög efterfrågan|skynda|sista chansen|tidsbegränsat|så långt lagret räcker|næsten udsolgt|snart udsolgt|sidste chance|skynd dig|så længe lager haves',
  'fast ausverkauft|bald ausverkauft|sehr gefragt|stark nachgefragt|beeil dich|letzte chance|nur für kurze zeit|solange der vorrat reicht|bijna uitverkocht|laatste kans|op is op|presque épuisé|dernière chance|dépêchez-vous|casi agotado|última oportunidad|date prisa',
  // a deadline
  '(?:offer|sale|deal|price|tilbudet?|salget|kampanjen?|erbjudandet|angebot|aanbieding|offre|oferta)\\s+(?:ends?|expires?|utløper|slutter|avsluttes|går ut|slutar|udløber|endet|eindigt|läuft ab|se termine|termina)\\s+(?:in|om|i|in|dans|en|soon|snart|bald)',
  '(?:ends|expires|utløper|slutter|slutar|udløber|endet) in\\s+\\d',
].join('|') + ')', 'iu');
// A clock that counts down: 02:13:44, 1d 02h 13m 44s, "2 timer 13 min 44 sek".
const CLOCK = /^\D{0,24}(?:\d{1,3}\s*(?:d|days?|dager|dagar|dage|tage|t|h|hrs?|hours?|timer|std|u)\s*[:.]?\s*)?\d{1,2}\s*(?::|h|hrs?|t|timer|std|u|m|min)\s*\d{1,2}\s*(?::|m|min|mins?)\s*\d{1,2}\s*(?:s|sek|sec|secs?)?\D{0,6}$/i;
const SPONSORED = /^(?:sponsored|sponset|sponsa|sponsrad|sponsoreret|gesponsert|gesponsord|sponsorisé|patrocinado|sponsorizzato|promoted|promotert|anzeige|annonse|annons|annonce|reklame|advertentie|publicité|publicidad|ad|ads)$/i;
const SUGGESTED = new RegExp('^(?:' + [
  'you (?:may|might) also (?:like|love|be interested)', 'recommended for you', 'recommendations for you', 'picked for you', 'inspired by your', 'more to (?:love|explore|consider)',
  '(?:customers|others|people|shoppers) (?:who (?:bought|viewed) this )?also (?:bought|viewed|liked|purchased)', 'frequently bought together', 'buy it with', 'complete the look', 'trending now', 'popular right now',
  'du vil kanskje også like', 'du liker kanskje også', 'anbefalt for deg', 'anbefalinger til deg', 'andre (?:kunder )?(?:har )?(?:kjøpte|kjøpt|så|sett) også', 'kunder som kjøpte', 'ofte kjøpt sammen', 'kjøpes ofte sammen', 'populært akkurat nå', 'fullfør looken',
  'du kanske också gillar', 'rekommenderat för dig', 'rekommenderas för dig', 'andra (?:kunder )?köpte också', 'köps ofta tillsammans', 'populärt just nu',
  'du vil måske også kunne lide', 'anbefalet til dig', 'andre (?:kunder )?købte også', 'købes ofte sammen',
  'das könnte (?:dir|ihnen) auch gefallen', 'empfehlungen für (?:dich|sie)', 'für (?:dich|sie) empfohlen', 'kunden (?:kauften|kaufen) auch', 'wird oft zusammen gekauft', 'gerade beliebt',
  'misschien vind je dit ook leuk', 'aanbevolen voor jou', 'anderen (?:kochten|bekeken) ook', 'vaak samen gekocht',
  'vous aimerez (?:aussi|peut-être)', 'recommandé pour vous', 'les clients ont (?:aussi|également) acheté', 'souvent achetés ensemble',
  'también te puede (?:gustar|interesar)', 'recomendado para ti', 'otros clientes también compraron', 'comprados juntos habitualmente',
].join('|') + ')', 'i');
// A pop-up that wants your e-mail address or your notifications.
const OFFER_PUSH = new RegExp(WB + '(?:' + [
  'newsletter|nyhetsbrev|nyhedsbrev|nieuwsbrief|infolettre|boletín|mailing list|e-?postliste|kundeklubb|kundklubb|kundeklub',
  '(?:sign up|subscribe|join|register|meld deg (?:på|inn)|bli medlem|registrer deg|anmäl dig|tilmeld dig|melde dich an|anmelden|schrijf je in|inscrivez-vous|suscríbete|regístrate).{0,60}(?:\\d+\\s?%|\\d+\\s?(?:kr|€|\\$|£)|rabatt|discount|off|korting|réduction|descuento|free shipping|fri frakt|gratis)',
  '(?:\\d+\\s?%|\\d+\\s?(?:kr|€|\\$|£)).{0,40}(?:off|rabatt|discount|korting|réduction|descuento).{0,60}(?:first|next|første|neste|första|nästa|erste|nächste|eerste|première|primer)',
  'get \\d+\\s?% off|få \\d+\\s?% (?:rabatt|på)|unlock (?:your )?\\d+|spin (?:the wheel|to win)|snurr (?:hjulet|og vinn)|win a |vinn en |enter your e-?mail|skriv inn (?:din )?e-?post|din e-?postadresse',
  '(?:allow|enable|turn on|get|tillat|aktiver|slå på|få|tillåt|aktivera|aktivieren|erlauben|autoriser|activar).{0,30}(?:notifications|push|varsler|varslinger|notiser|aviseringar|notifikationer|benachrichtigungen|meldingen|notificaciones)',
].join('|') + ')', 'iu');
const OWN_ERRAND = /(?:^|[/_.-])(?:checkout|check-out|kasse|kassen|cart|basket|bag|handlekurv|handlevogn|varukorg|warenkorb|winkelwagen|panier|login|log-?in|logg-?inn|signin|sign-in|account|konto|min-side|minside|payment|betaling|betal|order|bestilling)(?:[/_.?-]|$)/i;

// A shop: its own markup says so (a product, a cart, a shop platform), or the page is full of prices.
let shopSeen = null;
function shopPage() {
  if (shopSeen !== null) return shopSeen;
  const q = sel => document.querySelector(sel), body = document.body?.className || '';
  const ogType = q('meta[property="og:type"]')?.getAttribute('content') || '';
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(sc => sc.textContent).join(' ');
  return shopSeen = /^product/i.test(ogType) || /\b(?:woocommerce|shopify|magento|prestashop)\b/i.test(body) || /"@type"\s*:\s*"(?:Product|ProductGroup|Store|OnlineStore)"/.test(ld) ||
    !!q('script[src*="shopify"], link[href*="cdn.shopify.com"], meta[name="generator"][content*="WooCommerce" i], meta[name="generator"][content*="Shopify" i], meta[name="generator"][content*="PrestaShop" i], meta[name="generator"][content*="Magento" i]') ||
    !!q('form[action*="/cart"], [class*="add-to-cart" i], [class*="add_to_cart" i], [class*="addtocart" i], [name="add-to-cart"], [data-testid*="add-to-cart" i], a[href*="/cart"], a[href*="/handlekurv"], a[href*="/checkout"], a[href*="/kasse"], a[href*="/varukorg"], a[href*="/warenkorb"], a[href*="/basket"]') ||
    document.querySelectorAll('[itemprop="price"], [class*="price" i]:not([class*="prize" i])').length >= 10;
}

function runWebCalm(partsOff) {
  const on = id => !partsOff.includes(id);
  const sheet = () => { if (!document.getElementById('nothis-calm')) (document.head || document.documentElement).appendChild(calmStyle({})); };
  sheet();
  const off = el => { if (el.dataset.nothisCalm !== 'off') { el.dataset.nothisCalm = 'off'; calmCount++; } };
  const gone = el => !!el.closest('[data-nothis-calm="off"]');
  const ownErrand = OWN_ERRAND.test(location.pathname);
  let tapped = 0;
  for (const ev of ['pointerdown', 'touchstart', 'keydown', 'click']) addEventListener(ev, e => { if (e.isTrusted) tapped = Date.now(); }, { capture: true, passive: true });

  // Short texts of their own: the element that holds just that text, and a wrapper that holds nothing more (a badge).
  const badgeOf = (node, most) => {
    let el = node.parentElement;
    if (!el || el.closest('script, style, noscript, textarea, input, select, option, title, [contenteditable], nav, header, [role="navigation"]')) return null;
    if (el.textContent.trim().length > most) return null;
    while (el.parentElement && el.parentElement !== document.body && el.parentElement.textContent.trim().length <= el.textContent.trim().length + 12 && !el.parentElement.querySelector('img, picture, video, input, button, select')) el = el.parentElement;
    return el;
  };
  const texts = (root = document.body) => { const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let t = w.nextNode(); t; t = w.nextNode()) { const v = t.data.trim(); if (v.length >= 2 && v.length <= 90) out.push([t, v.replace(/\s+/g, ' ')]); } return out; };

  // pressure: the claims, and clocks that count down (looked at twice, a second apart: a clock that stands still, or one
  // that counts up like a video's, is left alone).
  const clockValue = t => { const n = (t.match(/\d+/g) || []).map(Number); return n.reduce((a, x) => a * 60 + x, 0); };
  const clocks = new Map();
  const pressure = all => {
    for (const [node, text] of all) {
      if (gone(node.parentElement)) continue;
      if (PRESSURE.test(text)) { const b = badgeOf(node, 120); if (b) off(b); }
    }
    // A clock is often one element per digit pair: read the text of small boxes instead of single nodes.
    for (const el of document.querySelectorAll('[class*="countdown" i], [class*="count-down" i], [class*="timer" i], [id*="countdown" i], [data-countdown], time')) {
      if (gone(el) || el.closest('video, audio, [class*="player" i], nav, header')) continue;
      const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length < 5 || t.length > 60 || !CLOCK.test(t)) continue;
      const was = clocks.get(el), now = clockValue(t);
      if (was === undefined) { clocks.set(el, now); setTimeout(look, 1300); }
      else if (now < was) {
        // With the line that goes with it ("Offer ends in"), when that is all its box holds.
        let box = el; while (box.parentElement && box.parentElement !== document.body && box.parentElement.textContent.trim().length <= t.length + 60 && !box.parentElement.querySelector('img, picture, input, button, a[href]')) box = box.parentElement;
        off(box); clocks.delete(el);
      } else clocks.set(el, now);
    }
  };

  // sponsored: the label, then the card it sits in: the nearest box that is one of at least three alike in a row or grid.
  const cardOf = el => {
    for (let n = el, i = 0; n.parentElement && n.parentElement !== document.body && i < 14; n = n.parentElement, i++) {
      const sibs = [...n.parentElement.children].filter(c => c.tagName === n.tagName);
      if (sibs.length >= 3 && n.querySelector('a[href], img') && n.getBoundingClientRect().height < innerHeight * 1.5) return n;
    }
    return null;
  };
  const sponsored = all => { for (const [node, text] of all) if (SPONSORED.test(text) && !gone(node.parentElement) && !node.parentElement.closest('nav, header, footer, button, a[href*="advert" i]')) { const c = cardOf(node.parentElement); if (c) off(c); } };

  // suggested: a heading that says so, and the box it heads: as far up as the heading is still the only one, and never
  // most of the page.
  const suggested = () => {
    for (const h of document.querySelectorAll('h2, h3, h4, [role="heading"], [class*="title" i], [class*="heading" i]')) {
      if (gone(h)) continue;
      const t = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length < 8 || t.length > 70 || !SUGGESTED.test(t) || h.closest('nav, header, footer')) continue;
      let box = h;
      const heads = n => n.querySelectorAll('h1, h2, h3').length, own = Math.max(heads(h), /^H[1-3]$/.test(h.tagName) ? 1 : 0);
      while (box.parentElement && !box.parentElement.matches('body, main, [role="main"], #main, #content, article') && heads(box.parentElement) <= own && box.parentElement.getBoundingClientRect().height < innerHeight * 2.5) box = box.parentElement;
      // The heading alone means the row is its next sibling.
      if (box === h && h.nextElementSibling && !h.nextElementSibling.querySelector('h1, h2, h3')) off(h.nextElementSibling);
      if (box.getBoundingClientRect().height < Math.max(document.documentElement.scrollHeight * 0.5, innerHeight)) off(box);
    }
  };

  // offers: a layer over the page that the page opened by itself, with a field for your e-mail address (and no password:
  // that is a login) or words that ask for it or for notifications.
  const offers = () => {
    if (ownErrand || Date.now() - tapped < 2500) return;
    for (const d of document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], [class*="modal" i], [class*="popup" i], [class*="pop-up" i], [class*="overlay" i], [class*="newsletter" i], [id*="popup" i], [id*="modal" i], .klaviyo-form, .needsclick')) {
      if (d.dataset.nothisCalm === 'off' || d.dataset.nothisPush === 'yours' || gone(d) || d.querySelector('input[type="password"]')) continue;
      const r = d.getBoundingClientRect(); if (r.width < 120 || r.height < 60) continue;
      const t = (d.innerText || d.textContent || '').slice(0, 1500);
      if (!t.trim() || calmConsent(d, t)) continue;
      const mail = !!d.querySelector('input[type="email"], input[name*="email" i], input[placeholder*="mail" i], input[autocomplete="email"]');
      if (!(mail && t.length < 1200) && !OFFER_PUSH.test(t)) continue;
      const layer = calmLayerOf(d);
      // Only what lies over the page: a sign-up form in the page itself (the footer) is no interruption.
      if (!layer || !calmFixed(layer) || layer.matches('header, nav, footer, main, body') || layer.querySelector('main, [role="main"], nav')) continue;
      layer.dataset.nothisPush = '';
      off(layer);
      for (const sib of layer.parentElement?.children || []) if (sib !== layer && !sib.textContent.trim() && calmFixed(sib) && calmBig(sib)) off(sib);
      document.documentElement.dataset.nothisUnlock = '';
    }
  };

  // motion: a silent video without controls that starts without you (a background or a banner) is stopped where it is.
  const still = v => {
    if (!on('motion') || v.dataset.nothisPlay === 'yours' || !v.muted || v.controls) return;
    if (Date.now() - tapped < 1500) { v.dataset.nothisPlay = 'yours'; return; }
    if (!v.dataset.nothisPlay) { v.dataset.nothisPlay = 'stopped'; calmCount++; }
    v.removeAttribute('autoplay'); v.removeAttribute('loop');
    try { v.pause(); } catch {}
  };
  if (on('motion')) document.addEventListener('play', e => { if (e.target?.tagName === 'VIDEO') still(e.target); }, true);

  let timer = 0, last = 0;
  function look() {
    last = Date.now();
    if (!document.body) return;
    sheet();
    const shop = shopPage();
    if (shop && !ownErrand && (on('pressure') || on('sponsored'))) { const all = texts(); if (on('pressure')) pressure(all); if (on('sponsored')) sponsored(all); }
    if (shop && !ownErrand && on('suggested')) suggested();
    if (on('offers')) offers();
    if (on('motion')) for (const v of document.querySelectorAll('video')) if (!v.paused) still(v);
  }
  look();
  new MutationObserver(() => { if (document.hidden) return; clearTimeout(timer); timer = setTimeout(look, Math.max(400, 1500 - (Date.now() - last))); })
    .observe(document.documentElement, { childList: true, subtree: true });
  // Pop-ups are often only made visible (a class), not added: looked for a few times as the page settles.
  for (const ms of [2000, 5000, 9000, 15000, 30000]) setTimeout(look, ms);
}
