// ==UserScript==
// @name         Bandcamp Volume Control
// @namespace    sindre.bandcamp.volume
// @version      1.1
// @description  Per-site volume control and seek bar for Bandcamp, with persistent volume
// @match        https://*.bandcamp.com/*
// @match        https://bandcamp.com/*
// @grant        none
// @run-at       document-end
// @license      MIT
// @homepageURL  https://github.com/Zindre/userscripts
// @supportURL   https://github.com/Zindre/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/Zindre/userscripts/main/bandcamp-volume.user.js
// @downloadURL  https://raw.githubusercontent.com/Zindre/userscripts/main/bandcamp-volume.user.js
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'bc-volume';
  const getVolume = () => {
    const v = parseFloat(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  };
  const setVolume = (v) => localStorage.setItem(STORAGE_KEY, String(v));

  const applyToAll = (vol) => {
    document.querySelectorAll('audio').forEach((a) => {
      a.volume = vol;
    });
  };

  const fmt = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  };

  // Bandcamp's CSP forbids inline style="..." attributes (and <style> blocks),
  // so build everything with createElement and set styles via the CSSOM.
  const make = (tag, style, text) => {
    const e = document.createElement(tag);
    if (style) for (const k in style) e.style[k] = style[k];
    if (text != null) e.textContent = text;
    return e;
  };

  const ui = make('div', {
    position: 'fixed', bottom: '12px', right: '12px', zIndex: '999999',
    background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '8px 10px',
    borderRadius: '6px',
    font: '12px -apple-system, system-ui, sans-serif',
    display: 'flex', flexDirection: 'column', gap: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  });

  const rowStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
  const volRow = make('div', rowStyle);
  const seekRow = make('div', rowStyle);

  const tabular = { fontVariantNumeric: 'tabular-nums' };
  const leftCol = { width: '40px', textAlign: 'right', ...tabular };
  const rightCol = { width: '40px', textAlign: 'left', ...tabular };
  const sliderStyle = { width: '200px', margin: '0' };

  const volLabel = make('span', leftCol, 'Vol');
  const volSlider = make('input', sliderStyle);
  volSlider.type = 'range'; volSlider.min = '0'; volSlider.max = '1'; volSlider.step = '0.01';
  const volPct = make('span', rightCol);
  volRow.append(volLabel, volSlider, volPct);

  const curEl = make('span', leftCol, '--:--');
  const seekSlider = make('input', sliderStyle);
  seekSlider.type = 'range'; seekSlider.min = '0'; seekSlider.max = '100'; seekSlider.step = '0.1';
  seekSlider.value = '0'; seekSlider.disabled = true;
  const totEl = make('span', rightCol, '--:--');
  seekRow.append(curEl, seekSlider, totEl);

  ui.append(volRow, seekRow);

  const initial = getVolume();
  volSlider.value = String(initial);
  volPct.textContent = Math.round(initial * 100) + '%';

  volSlider.addEventListener('input', () => {
    const v = parseFloat(volSlider.value);
    setVolume(v);
    volPct.textContent = Math.round(v * 100) + '%';
    applyToAll(v);
  });

  let activeAudio = null;
  let isSeeking = false;

  const updateSeekUi = () => {
    if (!activeAudio || !Number.isFinite(activeAudio.duration) || activeAudio.duration <= 0) {
      seekSlider.disabled = true;
      seekSlider.value = '0';
      curEl.textContent = '--:--';
      totEl.textContent = '--:--';
      return;
    }
    seekSlider.disabled = false;
    seekSlider.max = String(activeAudio.duration);
    if (!isSeeking) {
      seekSlider.value = String(activeAudio.currentTime);
      curEl.textContent = fmt(activeAudio.currentTime);
    }
    totEl.textContent = fmt(activeAudio.duration);
  };

  const setActive = (a) => {
    if (a === activeAudio) return;
    activeAudio = a;
    updateSeekUi();
  };

  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLAudioElement) {
      e.target.volume = getVolume();
      setActive(e.target);
    }
  }, true);
  document.addEventListener('loadedmetadata', (e) => {
    if (e.target instanceof HTMLAudioElement) {
      e.target.volume = getVolume();
      if (e.target === activeAudio) updateSeekUi();
    }
  }, true);
  ['timeupdate', 'durationchange', 'pause', 'ended', 'seeked'].forEach((ev) => {
    document.addEventListener(ev, (e) => {
      if (e.target === activeAudio) updateSeekUi();
    }, true);
  });

  seekSlider.addEventListener('mousedown', () => { isSeeking = true; });
  seekSlider.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });
  seekSlider.addEventListener('input', () => {
    if (activeAudio) curEl.textContent = fmt(parseFloat(seekSlider.value));
  });
  seekSlider.addEventListener('change', () => {
    if (activeAudio) activeAudio.currentTime = parseFloat(seekSlider.value);
    isSeeking = false;
    updateSeekUi();
  });

  const observer = new MutationObserver(() => {
    applyToAll(getVolume());
    if (activeAudio && !document.contains(activeAudio)) {
      activeAudio = null;
      updateSeekUi();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.body.appendChild(ui);
  applyToAll(initial);
})();
