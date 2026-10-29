#!/usr/bin/env node
// Revokes the development certificates that earlier CI builds left behind. Each GitHub runner starts
// without a signing identity, so `xcodebuild -allowProvisioningUpdates` makes a new development
// certificate ("Created via API") for every archive, and Apple stops issuing them after about ten.
// They are useless once the runner is gone. Only development certificates named "Created via API"
// are touched: never distribution certificates, never ones made in Xcode on a Mac.
// The workflow now archives with a stored certificate (SIGNING_CERT_P12), so this finds nothing
// unless that secret is missing or Xcode made a certificate anyway.
//
// Uses the App Store Connect API key from the environment, as release.sh does:
// ASC_KEY_PATH (the .p8 file), ASC_KEY_ID, ASC_ISSUER_ID. Never fails the build: a certificate that
// can't be revoked is reported and left.
import { existsSync, readFileSync } from 'node:fs';
import { sign } from 'node:crypto';

const { ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID } = process.env;
// The key is missing when an earlier step failed before writing it.
if (!ASC_KEY_PATH || !ASC_KEY_ID || !ASC_ISSUER_ID || !existsSync(ASC_KEY_PATH)) { console.log('No App Store Connect API key; nothing to do.'); process.exit(0); }

const b64 = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
const token = `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key: readFileSync(ASC_KEY_PATH, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;

const api = (path, method = 'GET') => fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
const DEVELOPMENT = new Set(['DEVELOPMENT', 'IOS_DEVELOPMENT', 'MAC_APP_DEVELOPMENT']);

try {
  const r = await api('certificates?limit=200&fields[certificates]=name,displayName,certificateType,expirationDate');
  if (!r.ok) throw new Error(`listing certificates: HTTP ${r.status} ${await r.text()}`);
  const stale = (await r.json()).data.filter(c => DEVELOPMENT.has(c.attributes.certificateType) &&
    [c.attributes.name, c.attributes.displayName].includes('Created via API'));
  let revoked = 0;
  for (const c of stale) {
    const d = await api(`certificates/${c.id}`, 'DELETE');
    if (d.ok) revoked++;
    else console.log(`::warning::Could not revoke certificate ${c.id}: HTTP ${d.status}`);
  }
  console.log(`Revoked ${revoked} of ${stale.length} CI development certificates.`);
} catch (e) {
  console.log(`::warning::${e.message}`);
}
