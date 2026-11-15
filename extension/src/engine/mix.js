// ───────────────────────────── My news ─────────────────────────────
// The news sites the user reads, learnt from their own visits, and their front pages together on one calm page: the My
// news page (mix.html, opened from the popup). Every visit to a known news site counts once per tab; the count fades
// with a half-life of two weeks, so the list follows what is read now. It stays in this browser (and goes to the user's
// other devices with the rest, see background.js). The page reads each site's front page as downloaded HTML through a
// second copy of the engine (extract.js, built for it: wdExtract), so each site is read by its own rules.
const VISIT_HALF_LIFE = 14 * 864e5, MIX_SITES = 8, MIX_PER_SITE = 30;
const visitScore = (e, now = Date.now()) => (e?.s || 0) * Math.pow(0.5, (now - (e?.at || now)) / VISIT_HALF_LIFE);
async function recordVisit() {
  try { if (sessionStorage.getItem('wd-visit') === host) return; sessionStorage.setItem('wd-visit', host); } catch {}
  const visits = (await gm.get('newsVisits', {})) || {}, now = Date.now();
  const name = norm(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '');
  visits[host] = { s: visitScore(visits[host], now) + 1, at: now, o: location.origin, n: name || visits[host]?.n || '' };
  await gm.set('newsVisits', Object.fromEntries(Object.entries(visits).sort((a, b) => visitScore(b[1], now) - visitScore(a[1], now)).slice(0, 60)));
}
// The sites for My news: the ones visited more than once lately, most visited first.
function mySites(visits) {
  const now = Date.now();
  return Object.entries(visits || {}).map(([h, e]) => ({ host: h, origin: e.o || 'https://' + h, name: e.n || h, score: visitScore(e, now) }))
    .filter(x => x.score >= 1.5).sort((a, b) => b.score - a.score).slice(0, MIX_SITES);
}
async function mixView() {
  document.title = T.myNews;
  const sites = mySites(startup.newsVisits);
  // Each site's front page, three at a time; its articles join the list as they come.
  const load = async (add, note) => {
    if (!sites.length) return note(T.mixEmpty);
    let done = 0;
    note(T.mixLoading(0, sites.length));
    const one = async st => {
      try {
        const r = await gm.xhr({ url: st.origin + '/', headers: { Accept: 'text/html' } });
        const doc = parseHtml(r.responseText), base = doc.createElement('base');
        base.href = r.finalUrl || st.origin + '/';
        doc.head.prepend(base);
        let items = (globalThis.wdExtract?.(new URL(base.href), doc)?.items || []).slice(0, 80);
        items.forEach((it, i) => { it.m.y = i; }); // nothing is laid out: the order on the page stands in for the height
        rankItems(items);
        items = items.filter(it => !mutedTopicOf(it.url, it.teaser)).slice(0, MIX_PER_SITE);
        for (const it of items) { it.host = st.host; it.section = st.host; }
        if (items.length) add(items);
      } catch (e) { console.warn('Web Detox: My news', st.host, e); }
      done++;
      note(done < sites.length ? T.mixLoading(done, sites.length) : '');
    };
    const queue = [...sites];
    await Promise.all([0, 1, 2].map(async () => { while (queue.length) await one(queue.shift()); }));
  };
  await plainView((startup.level || 'pictures') !== 'plain', { sites, load });
}
