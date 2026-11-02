// Fetches article pages for the content script. Content scripts cannot read cross-origin
// responses in Manifest V3; the background can, thanks to the extension's host permissions.
'use strict';
const api = globalThis.browser ?? globalThis.chrome;

// Safari only (the others have it in the manifest, and no scripting permission): snapchat-web.js, in the page's world.
const registerPageScript = async () => {
  await api.scripting.unregisterContentScripts({ ids: ['snapchat-web'] }).catch(() => {});
  await api.scripting.registerContentScripts([{ id: 'snapchat-web', matches: ['https://www.snapchat.com/web*', 'https://snapchat.com/web*'],
    js: ['snapchat-web.js'], runAt: 'document_start', world: 'MAIN' }]);
};
if (api.scripting) for (const ev of [api.runtime.onInstalled, api.runtime.onStartup]) ev.addListener(registerPageScript);

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
