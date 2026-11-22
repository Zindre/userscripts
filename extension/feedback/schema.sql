-- Web Detox feedback (worker.js). Apply with:
--   npx wrangler d1 execute webdetox-feedback --remote --file schema.sql
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,          -- when it arrived (UTC, ISO 8601)
  host TEXT NOT NULL,        -- the site
  path TEXT NOT NULL,        -- the page, without query or fragment
  problem TEXT NOT NULL,     -- missing | reader | media | broken | other
  note TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS reports_at ON reports (at);
CREATE INDEX IF NOT EXISTS reports_host ON reports (host);
