#!/usr/bin/env node
// Builds the NoThis web extension from src/ plus ../declickbait.user.js (the Declickbait userscript, used unchanged as
// the content script). Output: dist/<target>/ for chrome (also Edge), firefox and safari, and a zip
// per target for store upload. The version comes from the userscript's @version.
//
//   node build.mjs            all targets
//   node build.mjs safari     one target
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const userscript = join(root, '..', 'declickbait.user.js');
const version = readFileSync(userscript, 'utf8').match(/^\/\/ @version\s+(\S+)/m)[1];

const icons = sizes => Object.fromEntries(sizes.map(s => [s, `icons/icon-${s}.png`]));
const sites = ['http://*/*', 'https://*/*'];
const base = {
  manifest_version: 3,
  name: 'NoThis',
  version,
  description: "News without the bait: clear headlines, synopses, or a calm plain view of the site without ads. No tracking.",
  homepage_url: 'https://github.com/Zindre/userscripts',
  icons: icons([16, 32, 48, 96, 128, 256, 512]),
  action: { default_title: 'NoThis', default_popup: 'popup.html', default_icon: icons([16, 19, 32, 38, 48]) },
  permissions: ['storage'],
  host_permissions: sites,
  content_scripts: [{ matches: sites, js: ['gm-shim.js', 'declickbait.js'], run_at: 'document_idle' }],
};

const targets = {
  chrome: { ...base, background: { service_worker: 'background.js' } },
  firefox: {
    ...base,
    background: { scripts: ['background.js'] },
    browser_specific_settings: { gecko: { id: 'nothis@sedb.no', strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } },
  },
  // iOS only allows non-persistent background pages.
  safari: { ...base, icons: icons([16, 32, 48, 96, 128, 256, 512, 1024]), background: { scripts: ['background.js'], persistent: false } },
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(targets);
for (const t of wanted) {
  if (!targets[t]) throw new Error(`unknown target ${t}; use ${Object.keys(targets).join(', ')}`);
  const out = join(root, 'dist', t);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(join(root, 'src'), out, { recursive: true, filter: f => !f.endsWith('.svg') });
  cpSync(userscript, join(out, 'declickbait.js'));
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(targets[t], null, 2) + '\n');
  const zip = join(root, 'dist', `nothis-${t}-${version}.zip`);
  rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', '-X', zip, '.'], { cwd: out });
  console.log(`${t}: dist/${t}/ and dist/nothis-${t}-${version}.zip`);
}

// The Safari Xcode project (safari/, from safari-web-extension-packager) references dist/safari/;
// keep its app version in step with the extension's.
const pbxproj = join(root, 'safari', 'NoThis', 'NoThis.xcodeproj', 'project.pbxproj');
if (wanted.includes('safari') && existsSync(pbxproj))
  writeFileSync(pbxproj, readFileSync(pbxproj, 'utf8').replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`));
