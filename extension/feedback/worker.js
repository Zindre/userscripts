// Web Detox's feedback receiver: "this site doesn't work well", sent from the extension's menu with one tap.
// Keeps what the report says and nothing about who sent it: the page's address without its query or fragment, which
// problem was chosen, an optional note, the extension's version, reading level and browser. No IP address, no cookies.
// Read the reports in Cloudflare's dashboard (D1 → webdetox-feedback → reports), or with
//   npx wrangler d1 execute webdetox-feedback --remote --command "SELECT * FROM reports ORDER BY at DESC LIMIT 50"
// Deploy: npx wrangler deploy (in this folder). The table: schema.sql.

const PROBLEMS = new Set(['missing', 'reader', 'media', 'broken', 'other']);
const LEVELS = new Set(['vanilla', 'headlines', 'synopsis', 'pictures', 'plain', 'calm', '']);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
const reply = (status, body = '') => new Response(body, { status, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
const text = (v, max) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return reply(204);
    if (new URL(request.url).pathname !== '/report') return reply(404, 'Not found');
    if (request.method !== 'POST') return reply(405, 'POST only');
    // At most a few reports a minute from one address; the address is used for this count only, never kept.
    const { success } = await env.LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
    if (!success) return reply(429, 'Too many reports');
    const raw = await request.text();
    if (raw.length > 4000) return reply(413, 'Too long');
    let r; try { r = JSON.parse(raw); } catch { return reply(400, 'Not JSON'); }
    let page; try { page = new URL(text(r.url, 800)); } catch { return reply(400, 'No page address'); }
    if (!/^https?:$/.test(page.protocol)) return reply(400, 'No page address');
    const problem = text(r.problem, 20), level = text(r.level, 20);
    if (!PROBLEMS.has(problem)) return reply(400, 'Unknown problem');
    await env.DB.prepare('INSERT INTO reports (at, host, path, problem, note, version, level, browser) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(new Date().toISOString(), page.hostname, page.pathname.slice(0, 500), problem, text(r.note, 500),
        text(r.version, 20), LEVELS.has(level) ? level : '', text(r.browser, 40))
      .run();
    return reply(201, 'Thanks');
  },
};
