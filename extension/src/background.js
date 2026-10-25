// Fetches article pages for the content script. Content scripts cannot read cross-origin
// responses in Manifest V3; the background can, thanks to the extension's host permissions.
'use strict';
const api = globalThis.browser ?? globalThis.chrome;

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'declickbait-fetch' || !sender.tab) return;
  let url;
  try { url = new URL(msg.url); } catch { sendResponse({ error: 'bad url' }); return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') { sendResponse({ error: 'unsupported protocol' }); return; }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), msg.timeout || 12000);
  // Cookies included, as GM.xmlHttpRequest does: consent walls then serve the real article.
  fetch(url, { method: 'GET', headers: msg.headers || {}, credentials: 'include', redirect: 'follow', signal: ctrl.signal })
    .then(async r => sendResponse({ status: r.status, finalUrl: r.url, responseText: await r.text() }))
    .catch(e => sendResponse({ error: String(e), timedOut: e.name === 'AbortError' }))
    .finally(() => clearTimeout(timer));
  return true; // respond asynchronously
});
