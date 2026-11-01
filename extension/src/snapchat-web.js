// Snapchat for Web on a phone. Snapchat sends every browser whose user agent says iPhone, iPad or
// Android to a page that tells you to use a computer or the app (/web/mobile-landing.html), though
// the web app itself runs in a phone's browser. This runs in the page's own world (world: "MAIN" in
// the manifest), before Snapchat's scripts, and gives them the agent Safari sends when you ask for
// the desktop site. Only the scripts see it; requests keep the real one.
// At the Vanilla level gm-shim.js leaves "nothis-vanilla" in the site's storage, and this does
// nothing from the next load.
(() => {
  try { if (localStorage.getItem('nothis-vanilla')) return; } catch {}
  const ua = navigator.userAgent;
  if (!/iPhone|iPad|iPod|Android/.test(ua)) return;
  const safari = ua.match(/Version\/[\d.]+/)?.[0] || 'Version/26.0';
  const mac = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) ${safari} Safari/605.1.15`;
  for (const [name, value] of [['userAgent', mac], ['appVersion', mac.slice(8)], ['platform', 'MacIntel']])
    Object.defineProperty(Navigator.prototype, name, { get: () => value, configurable: true });
})();
