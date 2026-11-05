#!/usr/bin/env node
// Sets the app's name on the App Store. Apple only lets the name change on an App Store version that
// is still being prepared: this uses the one there is (such as the draft 1.0 of an app not yet on the
// App Store), and only makes iOS VERSION when there is none. Saving the name also reserves it; App Store
// Connect refuses a name another app already uses, and that error is printed. Nothing goes to App
// Review; the name shows on the App Store once that version has been reviewed and released.
//
//   APP_NAME="Web Detox" VERSION=1.21.0 node app-store-name.mjs
//
// Uses the App Store Connect API key from the environment, as release.sh does:
// ASC_KEY_PATH (the .p8 file), ASC_KEY_ID, ASC_ISSUER_ID.
import { readFileSync } from 'node:fs';
import { sign } from 'node:crypto';

const { ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID, APP_NAME, VERSION } = process.env;
if (!ASC_KEY_PATH || !ASC_KEY_ID || !ASC_ISSUER_ID) { console.log('::error::No App Store Connect API key'); process.exit(1); }
if (!APP_NAME || !VERSION) { console.log('::error::Set APP_NAME and VERSION'); process.exit(1); }

const b64 = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
const token = () => {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
  return `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key: readFileSync(ASC_KEY_PATH, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
};
const api = async (path, method = 'GET', body) => {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const json = r.status === 204 ? {} : await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json, error: json.errors?.map(e => e.detail || e.title).join('; ') };
};
const must = async (...a) => { const r = await api(...a); if (!r.ok) throw new Error(`${a[1] || 'GET'} ${a[0]}: HTTP ${r.status} ${r.error}`); return r.json; };

const app = (await must('apps?filter[bundleId]=no.sedb.NoThis&fields[apps]=name')).data[0];
if (!app) throw new Error('No app with bundle ID no.sedb.NoThis');
console.log(`App: ${app.attributes.name}`);

// The app information of a version being prepared (or sent back by App Review) can be changed.
const editable = new Set(['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY']);
const state = i => i.attributes.state || i.attributes.appStoreState;
const infos = async () => (await must(`apps/${app.id}/appInfos`)).data;
let info = (await infos()).find(i => editable.has(state(i)));

const versions = (await must(`apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data;
for (const v of versions) console.log(`iOS ${v.attributes.versionString}: ${v.attributes.appVersionState || v.attributes.appStoreState}`);
if (!info) {
  if (versions.some(v => v.attributes.versionString === VERSION)) throw new Error(`iOS ${VERSION} exists but its app information can't be changed`);
  await must('appStoreVersions', 'POST', { data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: VERSION },
    relationships: { app: { data: { type: 'apps', id: app.id } } } } });
  console.log(`Made iOS ${VERSION} (being prepared; nothing is sent to App Review)`);
  info = (await infos()).find(i => editable.has(state(i)));
  if (!info) throw new Error('No app information that can be changed, even after making the version');
}

let failed = false;
for (const l of (await must(`appInfos/${info.id}/appInfoLocalizations`)).data) {
  const { locale, name, subtitle } = l.attributes;
  if (name === APP_NAME) { console.log(`${locale}: already "${APP_NAME}"`); continue; }
  const r = await api(`appInfoLocalizations/${l.id}`, 'PATCH', { data: { type: 'appInfoLocalizations', id: l.id, attributes: { name: APP_NAME } } });
  if (r.ok) console.log(`${locale}: "${name}" → "${APP_NAME}" (subtitle: ${subtitle ? `"${subtitle}"` : 'none'})`);
  else { failed = true; console.log(`::error::${locale}: "${APP_NAME}" not accepted (HTTP ${r.status} ${r.error})`); }
}
process.exit(failed ? 1 : 0);
