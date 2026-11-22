// ───────────────────────────── Settings ─────────────────────────────
// One place that reads and changes the settings, used by the extension's popup (through
// GM.exposeSettings, see boot.js) and by the userscript's in-page panel (userscript/panel.js).
// hostOff: the script is switched off on this host (vanilla level, excluded or unlisted).
let hostOff = false, hostEnabled = false;

// display, level, topics and generic reload the page.
async function settingsAction(act, arg) {
  if (act === 'display') { await gm.set('display', arg); location.reload(); }
  else if (act === 'orig') toggle();
  else if (act === 'unset') { const [list, h] = arg; await gm.set(list, ((await gm.get(list, [])) || []).filter(x => x !== h)); }
  else if (act === 'level') {
    // vanilla is "off on this host" (disabledHosts); any other level switches the host back on.
    const disabled = (await gm.get('disabledHosts', [])) || [], enabled = (await gm.get('enabledHosts', [])) || [];
    if (arg === 'vanilla') { await gm.set('disabledHosts', [...new Set([...disabled, host])]); await gm.set('enabledHosts', enabled.filter(h => h !== host)); }
    else if (arg === 'calm' && webSite) {
      // Calm on a site of the rest of the web: switched on again, and not counted as a news site.
      await gm.set('disabledHosts', disabled.filter(h => h !== host)); await gm.set('enabledHosts', enabled.filter(h => h !== host));
      await gm.set('siteLevels', { ...((await gm.get('siteLevels', {})) || {}), [host]: 'calm' });
    }
    else {
      // A news level chosen on a site that isn't known as news makes it one (enabledHosts).
      if (hostOff || webSite) { await gm.set('disabledHosts', disabled.filter(h => h !== host)); await gm.set('enabledHosts', [...new Set([...enabled, host])]); }
      await gm.set('siteLevels', { ...((await gm.get('siteLevels', {})) || {}), [host]: arg });
    }
    location.reload();
  }
  else if (act === 'defaultLevel') { defaultLevel = arg; await gm.set('level', arg); }
  else if (act === 'topics') { await gm.set('mutedTopics', arg.filter(id => TOPICS[id])); location.reload(); }
  else if (act === 'bigPics') { await gm.set('plainBigPics', !!arg); location.reload(); }
  else if (act === 'games') { await gm.set('plainGames', !!arg); location.reload(); }
  else if (act === 'albumApp') { CFG.albumApp = ALBUM_APPS[arg] ? arg : ''; await gm.set('albumApp', CFG.albumApp); await gm.set('kasetLinks', false); location.reload(); }
  else if (act === 'swipeAnim') { CFG.swipeAnimation = !!arg; await gm.set('swipeAnimation', CFG.swipeAnimation); }
  else if (act === 'calmPart') {
    const [id, show] = arg, all = (await gm.get('calmParts', {})) || {}, key = calmSite ? calmSite.name : '*', partsOff = (all[key] || []).filter(p => p !== id);
    await gm.set('calmParts', { ...all, [key]: show ? partsOff : [...partsOff, id] });
    location.reload();
  }
  else if (act === 'generic') { await gm.set('genericSites', !CFG.genericSites); location.reload(); }
}

async function settingsState() {
  const others = async list => ((await gm.get(list, [])) || []).filter(h => h !== host);
  return { host, page: plainReading || location.origin + location.pathname, off: hostOff, level, calm: calmSite?.name || (webCalm ? host : null), web: webSite, defaultLevel, onArticle: onArticlePage(), plain: !!plainHost, display: CFG.display,
    genericSites: CFG.genericSites, swipeAnimation: CFG.swipeAnimation, albumApp: CFG.albumApp, bigPics: !!startup.plainBigPics, games: startup.plainGames !== false, showOriginal, mutedTopics: [...muted],
    calmParts: (webCalm ? WEB_PARTS.filter(p => !p.shop || shopPage()) : calmSite?.parts || []).filter(p => p.id).map(p => ({ id: p.id, label: p.label || p.id, show: !calmPartsOff.includes(p.id) })),
    fetchPausedUntil: fetchPausedUntil > Date.now() ? fetchPausedUntil : 0, topics: TOPIC_TREE, rewritten: calmSite ? calmCount : plainHost ? plainCount : rewritten.size,
    disabledHosts: await others('disabledHosts'), enabledHosts: await others('enabledHosts') };
}
