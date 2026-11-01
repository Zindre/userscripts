#!/usr/bin/env node
// Gives a TestFlight build to the beta testers: waits until App Store Connect has processed the iOS
// and macOS builds and sets their "What to Test" text from safari/what-to-test.txt. The iOS build goes
// to every beta group and to Beta App Review (a later build of a version already reviewed usually goes
// straight through). The macOS build only goes to the internal groups: no macOS version is approved
// for external testers, so it would wait in Apple's review queue.
//
//   BUILD=2611011001 node beta-testers.mjs   that build number
//   node beta-testers.mjs                     the newest upload
//
// Uses the App Store Connect API key from the environment, as release.sh does:
// ASC_KEY_PATH (the .p8 file), ASC_KEY_ID, ASC_ISSUER_ID.
import { readFileSync } from 'node:fs';
import { sign } from 'node:crypto';

const { ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID, BUILD } = process.env;
if (!ASC_KEY_PATH || !ASC_KEY_ID || !ASC_ISSUER_ID) { console.log('::error::No App Store Connect API key'); process.exit(1); }
const whatsNew = readFileSync(new URL('what-to-test.txt', import.meta.url), 'utf8').trim();

const b64 = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
// A token lasts at most 20 minutes and waiting for processing can take longer, so each call makes one.
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

const app = (await must('apps?filter[bundleId]=no.sedb.NoThis&fields[apps]=name')).data[0];
if (!app) throw new Error('No app with bundle ID no.sedb.NoThis');

// The iOS and macOS builds share a build number. A fresh upload can take a few minutes to show up,
// and processing usually 5 to 30 minutes.
let builds = [], versions = [], number = BUILD;
for (const end = Date.now() + 60 * 60e3; ; await sleep(30e3)) {
  if (!number) number = (await must(`builds?filter[app]=${app.id}&sort=-uploadedDate&limit=1`)).data[0]?.attributes.version;
  if (number) ({ data: builds, included: versions = [] } = await must(`builds?filter[app]=${app.id}&filter[version]=${number}&include=preReleaseVersion&limit=10`));
  const states = builds.map(b => b.attributes.processingState);
  console.log(`Build ${number}: ${states.join(', ') || 'not there yet'}`);
  if (states.some(s => s === 'FAILED' || s === 'INVALID')) throw new Error(`Build ${number} failed processing`);
  if (builds.length >= 2 && states.every(s => s === 'VALID')) break;
  if (Date.now() > end) throw new Error(`Build ${number} wasn't processed within an hour`);
}

const groups = (await must(`apps/${app.id}/betaGroups?fields[betaGroups]=name,isInternalGroup,hasAccessToAllBuilds&limit=50`)).data;
for (const b of builds) {
  const v = versions.find(v => v.id === b.relationships?.preReleaseVersion?.data?.id)?.attributes;
  const what = `${v?.platform || b.id} ${v?.version || ''} (${number})`;
  // What to Test: replace the text in each language the build already has, else add it in English.
  const locs = (await must(`builds/${b.id}/betaBuildLocalizations`)).data;
  if (locs.length) for (const l of locs) await must(`betaBuildLocalizations/${l.id}`, 'PATCH', { data: { type: 'betaBuildLocalizations', id: l.id, attributes: { whatsNew } } });
  else await must('betaBuildLocalizations', 'POST', { data: { type: 'betaBuildLocalizations', attributes: { locale: 'en-US', whatsNew },
    relationships: { build: { data: { type: 'builds', id: b.id } } } } });
  // Internal groups that see every build already have it.
  const ios = v?.platform === 'IOS';
  for (const g of groups.filter(g => !g.attributes.hasAccessToAllBuilds && (ios || g.attributes.isInternalGroup))) {
    const r = await api(`betaGroups/${g.id}/relationships/builds`, 'POST', { data: [{ type: 'builds', id: b.id }] });
    console.log(`${what}: ${r.ok ? 'added to' : `not added to (HTTP ${r.status} ${r.error})`} ${g.attributes.name}`);
  }
  // Only once: a build already submitted, in review or approved can't be submitted again.
  const ready = (await must(`builds/${b.id}/buildBetaDetail`)).data.attributes.externalBuildState === 'READY_FOR_BETA_SUBMISSION';
  if (ios && ready && groups.some(g => !g.attributes.isInternalGroup)) {
    const r = await api('betaAppReviewSubmissions', 'POST', { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: b.id } } } } });
    console.log(`${what}: ${r.ok ? 'submitted to Beta App Review' : `review submission: HTTP ${r.status} ${r.error}`}`);
  }
  const d = (await must(`builds/${b.id}/buildBetaDetail`)).data.attributes;
  console.log(`${what}: internal ${d.internalBuildState}, external ${d.externalBuildState}`);
}
