import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const CODE = /\.(ts|svelte|css|js|mjs|cjs|html)$/;
const HASH = /(\.ya?ml|\.sh|\.env\.example|\.gitignore|\.npmrc|\.prettierignore)$/;
const DELIMITERS = new Set(['/**', '/*', '*/', '<!--', '-->']);
/**
 * The news files are copy, not code, and a headline is retired by
 * commenting it out (GDD 3.7), which is a block comment by any other name.
 */
const COPY = /^src\/sim\/balance\/news\/(economic|government|natural|statements)\.ts$/;

/** Every comment in `text` longer than two text lines, as `line (n lines)`. */
function longComments(text: string, hashComments: boolean): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const s = lines[i]!.trim();
    const run = hashComments ? '#' : '//';

    if (s.startsWith(run) && !s.startsWith('#!')) {
      let j = i;

      while (j + 1 < lines.length && lines[j + 1]!.trim().startsWith(run)) j += 1;
      if (j - i + 1 > 2) out.push(`${i + 1} (${j - i + 1} lines)`);
      i = j + 1;
      continue;
    }

    if (!hashComments && (s.startsWith('/*') || s.startsWith('<!--'))) {
      const end = s.startsWith('/*') ? '*/' : '-->';
      let j = i;

      // The opener's own characters are skipped, so `/*/` is not read as closed.
      while (j < lines.length && !(j === i ? s.slice(2) : lines[j]!).includes(end)) j += 1;

      const text = lines.slice(i, j + 1).filter((l) => !DELIMITERS.has(l.trim())).length;

      if (text > 2) out.push(`${i + 1} (${text} lines)`);
      i = j + 1;
      continue;
    }

    i += 1;
  }

  return out;
}

function trackedFiles(): string[] {
  const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
    encoding: 'utf8',
  });

  return listed
    .split('\n')
    .filter(
      (f) => f && !f.startsWith('public/') && !COPY.test(f) && (CODE.test(f) || HASH.test(f)),
    );
}

describe('comments (CLAUDE.md, Writing)', () => {
  it('reads a comment by its text lines, not its delimiters', () => {
    expect(longComments('/**\n * one\n * two\n */\nconst a = 1;', false)).toEqual([]);
    expect(longComments('/**\n * one\n * two\n * three\n */', false)).toEqual(['1 (3 lines)']);
    expect(longComments('// one\n// two\n// three\nx();', false)).toEqual(['1 (3 lines)']);
    expect(longComments('<!--\n  one\n  two\n-->', false)).toEqual([]);
    expect(longComments('# one\n# two\n# three\nKEY=1', true)).toEqual(['1 (3 lines)']);
    expect(longComments('const url = "https://x"; // trailing', false)).toEqual([]);
  });

  it('holds every comment in the repo to two lines; the detail lives in docs/reference', () => {
    const offenders: string[] = [];

    for (const file of trackedFiles()) {
      const found = longComments(readFileSync(file, 'utf8'), HASH.test(file));

      for (const at of found) offenders.push(`${file}:${at}`);
    }

    expect(offenders).toEqual([]);
  });
});
