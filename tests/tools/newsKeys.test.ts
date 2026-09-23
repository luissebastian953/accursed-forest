import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { NEWS_TEMPLATES } from '../../src/sim/balance/news/index.ts';

/**
 * The families a news key can belong to. A literal outside these is some
 * other dotted string and none of this test's business.
 */
const FAMILY =
  /'((?:macro|price|estate|gov|authority|haze|ash|flood|drought|wildfire|storm|plague|regime|landslide|palmCert|ending)\.[A-Za-z0-9.]+)'/g;

/** A template entry, live or commented out, at the top level of a news file. */
const ENTRY = /^\s*(\/\/\s*)?'([A-Za-z0-9.]+)':\s*\{/gm;

/** Copy a developer may retire by commenting it out (GDD 3.7). */
const FREE = ['economic', 'government', 'natural', 'statements'];

function sourceFiles(): string[] {
  const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src'], {
    encoding: 'utf8',
  });

  return listed
    .split('\n')
    .filter((f) => f.endsWith('.ts') && !f.startsWith('src/sim/balance/news'));
}

/** The entries commented out of one news file, which is how copy is retired. */
function commentedOut(file: string): string[] {
  const text = readFileSync(`src/sim/balance/news/${file}.ts`, 'utf8');

  return [...text.matchAll(ENTRY)].filter((m) => m[1]).map((m) => m[2]!);
}

describe('news keys (GDD 3.7)', () => {
  it('every headline the code names is either printed or deliberately retired', () => {
    const retired = new Set(FREE.flatMap(commentedOut));
    const stem = (key: string, keys: Iterable<string>): boolean =>
      [...keys].some((k) => k.startsWith(`${key}.`));
    const missing: string[] = [];

    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8');

      for (const match of text.matchAll(FAMILY)) {
        const key = match[1]!;

        if (NEWS_TEMPLATES[key] || retired.has(key)) continue;
        // A stem, not a key: the code appends a tone or a reason to it.
        if (stem(key, Object.keys(NEWS_TEMPLATES)) || stem(key, retired)) continue;
        missing.push(`${file}: ${key}`);
      }
    }

    expect([...new Set(missing)]).toEqual([]);
  });

  it('the endings keep their copy: that file is not one to comment out of', () => {
    expect(commentedOut('endings')).toEqual([]);
  });
});
