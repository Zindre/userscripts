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
    else {
      if (hostOff) { await gm.set('disabledHosts', disabled.filter(h => h !== host)); await gm.set('enabledHosts', [...new Set([...enabled, host])]); }
      await gm.set('siteLevels', { ...((await gm.get('siteLevels', {})) || {}), [host]: arg });
    }
    location.reload();
  }
  else if (act === 'defaultLevel') { defaultLevel = arg; await gm.set('level', arg); }
  else if (act === 'topics') { await gm.set('mutedTopics', arg.filter(id => TOPICS[id])); location.reload(); }
  else if (act === 'generic') { await gm.set('genericSites', !CFG.genericSites); location.reload(); }
}

async function settingsState() {
  const others = async list => ((await gm.get(list, [])) || []).filter(h => h !== host);
  return { host, off: hostOff, level, defaultLevel, onArticle: onArticlePage(), plain: !!plainHost, display: CFG.display,
    genericSites: CFG.genericSites, showOriginal, mutedTopics: [...muted],
    topics: Object.fromEntries(Object.entries(TOPICS).map(([id, t]) => [id, t.label])), rewritten: plainHost ? plainCount : rewritten.size,
    disabledHosts: await others('disabledHosts'), enabledHosts: await others('enabledHosts') };
}
