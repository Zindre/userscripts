// The texts in every language: src/i18n/<code>.js, one file per language, each STRINGS.<code> = {...}. English (en.js)
// is the source, and stands in for a key a language leaves out. build.mjs joins the files after this one; the engine,
// the popup and the app's page all use them.
//
// stringsFor(tag) gives the texts for a language tag such as "nb-NO", "de" or "pt-BR": the list and the reader go by the
// site's language (<html lang>), the popup by the browser's, the app's page by the device's. Norwegian nynorsk and "no"
// get bokmål; a language with no file gets English.
function stringsFor(tag) {
  const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
  const code = base === 'no' || base === 'nn' ? 'nb' : STRINGS[base] ? base : 'en';
  const en = STRINGS.en, own = STRINGS[code] || {}, out = { ...en, ...own, lang: code };
  for (const k of ['pop', 'topic', 'part', 'app']) out[k] = { ...en[k], ...own[k] };
  return out;
}
