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
const ispo = args.has('ispo');
const spareForest = args.has('spare');

const rp = (n: number): string => (n / 1_000_000).toFixed(1).padStart(7) + 'M';

for (const seed of seeds) {
  const startBlocks = ispo ? Math.max(blocks, 3) : blocks;
  const { rows, lowestCash, ending, endedYear } = autoplay({
    seed,
    years,
    blocks: startBlocks,
    fertilize,
    ...(ispo
      ? { managePests: true, expand: { reserve: 40_000_000, maxBlocks: 24 }, spareForest }
      : {}),
  });
  console.log(
    `\nseed ${seed} · ${startBlocks} block(s)${ispo ? ' · expanding' : ''} · fertilize=${fertilize} · lowest cash ${rp(lowestCash)} · ending ${ending ?? '—'}${endedYear ? ` in year ${endedYear}` : ''}`,
  );
  console.log('  year    cash      net   profit   sold kg  planted bearing  price  ISPO');
  for (const r of rows) {
    console.log(
      `  ${String(r.year).padStart(4)} ${rp(r.cash)} ${rp(r.net)} ${rp(r.profit)} ${String(Math.round(r.soldKg)).padStart(8)} ${String(r.planted).padStart(8)} ${String(r.bearing).padStart(7)} ${String(r.tbsPrice).padStart(6)}   ${r.conditions}/5`,
    );
  }
}
