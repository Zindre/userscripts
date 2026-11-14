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

// Ads in front of videos: the video player asks an ad schedule (VMAP) or an ad (VAST) from these addresses
// before the video. Blocked, it plays the video straight away. Schibsted's player: VG, VGTV, Aftenposten, BT, E24,
// Aftonbladet, SvD. Replaced as a whole on every start, so a rule taken out here goes from the browser too.
const AD_RULES = ['||vmap.stream.schibsted.media^', '||adnxs-simple.com/ptv'].map((urlFilter, i) =>
  ({ id: i + 1, priority: 1, action: { type: 'block' }, condition: { urlFilter, resourceTypes: ['xmlhttprequest', 'media', 'other'] } }));
const blockVideoAds = async () => {
  if (!api.declarativeNetRequest) return;
  const old = (await api.declarativeNetRequest.getDynamicRules()).map(r => r.id);
  await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old, addRules: AD_RULES }).catch(e => console.warn('Web Detox: ad rules', e));
};
for (const ev of [api.runtime.onInstalled, api.runtime.onStartup]) ev.addListener(blockVideoAds);

// Safari only (nativeMessaging): whether the extension may run on all websites, for the app's first screen, which can't
// ask Safari that itself. Checked each time Safari starts this page; told to the app when it changed, or once an hour.
const reportAccess = async force => {
  if (!api.runtime.sendNativeMessage || !api.permissions) return;
  try {
    const all = await api.permissions.contains({ origins: ['http://*/*', 'https://*/*'] });
    const { accessTold } = await api.storage.local.get('accessTold');
    if (force !== true && accessTold?.all === all && Date.now() - accessTold.at < 3600e3) return;
    await api.runtime.sendNativeMessage('no.sedb.NoThis', { type: 'access', all });
    await api.storage.local.set({ accessTold: { all, at: Date.now() } });
  } catch (e) { console.warn('Web Detox: access report', e); }
};
for (const ev of [api.permissions?.onAdded, api.permissions?.onRemoved]) ev?.addListener(() => reportAccess(true));
reportAccess();
api.runtime.onMessage.addListener(msg => { if (msg?.type === 'nothis-access') reportAccess(); });

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
