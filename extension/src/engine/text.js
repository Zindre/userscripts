// ───────────────────────────── Text: cleanup and bait scoring ─────────────────────────────
const norm = s => (s || '').replace(/[\u00AD\u200B\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim(); // drop soft hyphens / zero-width joiners

function fixCase(s) {
  const CAPS = /^[A-ZÆØÅÄÖÜ]{3,}$/, ANYCAPS = /^[A-ZÆØÅÄÖÜ]+$/;
  const words = s.split(' ');
  const segs = w => w.replace(/[.,:!?'’"»]+$/, '').split('-');
  const capsWords = words.filter(w => segs(w).some(p => CAPS.test(p) && !ACRONYMS.has(p)));
  if (capsWords.length === 0) return s;
  const allCaps = capsWords.length >= Math.max(2, words.length * 0.6);
  return words.map((w, i) => {
    const punct = (w.match(/[.,:!?'’"»]+$/) || [''])[0];
    const out = segs(w).map(p => {
      if (ACRONYMS.has(p)) return p;
      if (allCaps ? !ANYCAPS.test(p) : (!CAPS.test(p) || p.length < 5)) return p;
      return p.toLowerCase();
    }).join('-') + punct;
    return i === 0 && /^[a-zæøå]/.test(out) ? out[0].toUpperCase() + out.slice(1) : out;
  }).join(' ');
}

function stripLabels(s) {
  let out = norm(s), prev;
  do { prev = out; for (const re of LABELS.concat(site?.strip || [])) out = out.replace(re, ''); } while (out !== prev && out);
  return out || norm(s);
}

function applyRules(s) {
  let out = stripLabels(s);
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  out = fixCase(norm(out));
  if (out && /^[a-zæøå]/.test(out)) out = out[0].toUpperCase() + out.slice(1);
  return out;
}

function baitScore(s) {
  if (!s) return 99;
  let n = 0;
  if (VAGUE_OPENERS.test(s)) n += 2;
  if (VAGUE_REFS.test(s)) n += 2;
  if (VAGUE_END.test(s)) n += 2; // ends by pointing: "... så skjer dette"
  if (/[?:…]$|\.\.\.$/.test(s)) n += 2;
  if (/!/.test(s)) n += 1;
  if (/^[«"“].*[»"”]$/.test(s)) n += 2;               // quote-only teaser
  if (/\b[A-ZÆØÅ]{4,}\b/.test(s) && !ACRONYMS.has(s.match(/\b[A-ZÆØÅ]{4,}\b/)[0])) n += 1;
  n += (s.match(new RegExp(TRIGGERS.source, 'gi')) || []).length;
  if (s.split(' ').length <= 4) n += 1;                // too short to carry facts
  return n;
}

function truncate(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const m = cut.match(/^(.*[.!?])\s/);
  if (m && m[1].length > max * 0.4) return m[1];
  return cut.replace(/\s+\S*$/, '') + '…';
}
