import { existsSync } from 'node:fs';

import {
  describeIndexNowStatus,
  INDEXNOW_ENDPOINT,
  indexNowPayload,
  normalizeIndexNowKey,
} from './indexnow.ts';
import { normalizeSiteUrl } from './seo.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const paths = argv.filter((arg) => !arg.startsWith('--'));
const siteUrl = normalizeSiteUrl(process.env['VITE_SITE_URL']);
const key = normalizeIndexNowKey(process.env['VITE_INDEXNOW_KEY']);

if (!siteUrl || !key) {
  console.error('Set VITE_SITE_URL and VITE_INDEXNOW_KEY, in the environment or .env.');
  process.exit(1);
}

const payload = indexNowPayload(siteUrl, key, paths.length > 0 ? paths : undefined);

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

// The live key file is the proof the deploy landed with this key; submitting first would 403.
const keyFile = await fetch(`${payload.keyLocation}?cb=${Date.now()}`);
const served = keyFile.ok ? (await keyFile.text()).trim() : '';

if (served !== key) {
  console.error(
    `${payload.keyLocation} answered ${keyFile.status} without the key: has the deploy with VITE_INDEXNOW_KEY landed?`,
  );
  process.exit(1);
}

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

console.log(
  `IndexNow ${response.status}, ${describeIndexNowStatus(response.status)}: ${payload.urlList.length} URLs`,
);

if (!response.ok) process.exit(1);
