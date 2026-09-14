/**
 * Headless balance sweep (§5, §10.3): run the scripted player for N years on
 * a few seeds and print the yearly cash curve.
 *
 *   pnpm sweep                     # 1 block, 8 years, seeds 1 42 1234
 *   pnpm sweep -- --blocks 2 --years 10 --seeds 7,8,9 --fertilize
 */

import { autoplay } from '../src/sim/autoplay.ts';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]!;
  if (!arg.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next !== undefined && !next.startsWith('--')) {
    args.set(arg.slice(2), next);
    i += 1;
  } else {
    args.set(arg.slice(2), 'true');
  }
}

const blocks = Number(args.get('blocks') ?? 1);
const years = Number(args.get('years') ?? 8);
const seeds = (args.get('seeds') ?? '1,42,1234').split(',').map(Number);
const fertilize = args.has('fertilize');

const rp = (n: number): string => (n / 1_000_000).toFixed(1).padStart(7) + 'M';

for (const seed of seeds) {
  const { rows, lowestCash } = autoplay({ seed, years, blocks, fertilize });
  console.log(
    `\nseed ${seed} · ${blocks} block(s) · fertilize=${fertilize} · lowest cash ${rp(lowestCash)}`,
  );
  console.log('  year    cash      net   sold kg  planted bearing  price');
  for (const r of rows) {
    console.log(
      `  ${String(r.year).padStart(4)} ${rp(r.cash)} ${rp(r.net)} ${String(Math.round(r.soldKg)).padStart(8)} ${String(r.planted).padStart(8)} ${String(r.bearing).padStart(7)} ${String(r.tbsPrice).padStart(6)}`,
    );
  }
}
