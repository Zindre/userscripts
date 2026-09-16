// ==UserScript==
// @name        Readable fonts
// @match       *://*/*
// @exclude     *://app.tripletex.no/*
// @grant       none
// @license      MIT
// @homepageURL  https://github.com/Zindre/userscripts
// @supportURL   https://github.com/Zindre/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/Zindre/userscripts/main/readable-fonts.user.js
// @downloadURL  https://raw.githubusercontent.com/Zindre/userscripts/main/readable-fonts.user.js
// ==/UserScript==

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;700&display=swap');
  html body h1, html body h2, html body h3, html body h4,
  html body p, html body li, html body td, html body div,
  html body span, html body a, html body button, html body figcaption {
    font-family: 'Atkinson Hyperlegible Next', sans-serif !important;
  }
  html body code, html body pre, html body code *, html body pre * {
    font-family: ui-monospace, 'SF Mono', monospace !important;
  }
`;
const style = document.createElement('style');
style.textContent = css;
document.documentElement.appendChild(style);   