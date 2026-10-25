// ───────────────────────────── Choosing the replacement ─────────────────────────────
function choose(teaser, meta) {
  const cleaned = applyRules(teaser);
  if (!meta) return { text: cleaned, lead: '' };
  let title = applyRules(meta.title);
  if (title.split(' ').length < 2) title = ''; // a lone brand/section name ("Nordlys") is not a headline
  // A description the publisher cut off ("… mellomvalget. Vid…") ends at its last full sentence.
  const whole = d => /(?:…|\.\.\.)\s*$/.test(d) && /[.!?]\s/.test(d) ? d.replace(/^([\s\S]*[.!?])\s[\s\S]*$/, '$1') : d;
  const desc = meta.desc ? truncate(applyRules(whole(meta.desc)), CFG.maxLen) : '';
  const same = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();
  let text;
  if (CFG.mode === 'title') text = title || desc || cleaned;
  else if (CFG.mode === 'description') text = desc || title || cleaned;
  else {
    const tScore = baitScore(cleaned), aScore = baitScore(title);
    // The site's own headline can point just as vaguely ("Gjør dette under talen"): then the lead says it.
    const vague = t => VAGUE_REFS.test(t) || VAGUE_END.test(t);
    if (title && !same(title, cleaned) && aScore < tScore && !(desc && vague(title))) text = title;
    else if (desc && tScore >= 2 && !same(desc, cleaned)) text = desc;
    else if (title && !same(title, cleaned) && aScore <= tScore) text = title;
    else text = cleaned;
  }
  // Lead: shown after the headline unless it is the headline or merely repeats it.
  let lead = '';
  if (CFG.includeLead && desc && !same(desc, text)) {
    const d = desc.toLowerCase(), t = text.toLowerCase().replace(/[.!?…]+$/, '');
    if (d.startsWith(t)) text = desc; else lead = desc;
  }
  return { text, lead };
}
