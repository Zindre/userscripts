// ==UserScript==
// @name         Google video thumbnails → YouTube watch page
// @version      1.4
// @match        *://www.google.com/*
// @grant        none
// @inject-into  auto
// @run-at       document-end
// @license      MIT
// @homepageURL  https://github.com/Zindre/userscripts
// @supportURL   https://github.com/Zindre/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/Zindre/userscripts/main/google-yt-thumbs.user.js
// @downloadURL  https://raw.githubusercontent.com/Zindre/userscripts/main/google-yt-thumbs.user.js
// ==/UserScript==

(() => {
  "use strict";

  function watchUrl(href) {
    if (!href) return null;
    let u;
    try { u = new URL(href, location.href); } catch { return null; }
    if (u.hostname === "www.google.com" && u.pathname === "/url") {
      const q = u.searchParams.get("q") || u.searchParams.get("url");
      if (!q) return null;
      try { u = new URL(q); } catch { return null; }
    }
    const hosts = ["www.youtube.com", "youtube.com", "m.youtube.com"];
    if (hosts.includes(u.hostname) && u.pathname === "/watch" && u.searchParams.get("v"))
      return `https://www.youtube.com/watch?v=${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be" && /^\/[\w-]{11}$/.test(u.pathname))
      return `https://www.youtube.com/watch?v=${u.pathname.slice(1)}`;
    return null;
  }

  // Find a watch URL for a click that didn't land on an anchor:
  // walk up ancestors; at each level check data attributes, then any
  // contained anchor (the title link lives in the same result block).
  function findNearbyWatchUrl(start) {
    let el = start;
    for (let depth = 0; el && el !== document.body && depth < 12; depth++, el = el.parentElement) {
      if (el.dataset) {
        for (const v of Object.values(el.dataset)) {
          const url = watchUrl(v);
          if (url) return url;
        }
      }
      for (const a of el.querySelectorAll("a[href]")) {
        const url = watchUrl(a.getAttribute("href"));
        if (url) return url;
      }
    }
    return null;
  }

  document.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const a = e.target.closest?.("a[href]");
    let url = a ? watchUrl(a.getAttribute("href")) : null;

    if (!url && !a) url = findNearbyWatchUrl(e.target);

    if (!url) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.assign(url);
  }, true);
})();
