import { describe, expect, it } from 'vitest';

import { ToastPolicy } from '../../src/ui/toastPolicy.ts';

describe('what the estate is allowed to say, and how often (GDD 8)', () => {
  it('shows the first notice at once', () => {
    const p = new ToastPolicy();

    expect(p.offer('Ripe: block 12 is ready to harvest.', 'info', 1000, 0, 3)).toBe('show');
  });

  it('says everything while the strip has room, however fast it comes', () => {
    const p = new ToastPolicy({ minGapMs: 700 });

    expect(p.offer('Sold 1.2 t of TBS.', 'info', 1000, 0, 3)).toBe('show');
    expect(p.offer('Ripe: block 12.', 'info', 1010, 1, 3)).toBe('show');
    expect(p.offer('Year 4 begins.', 'info', 1020, 2, 3)).toBe('show');
  });

  it('drops a notice that would push an unread one off a full strip', () => {
    const p = new ToastPolicy({ minGapMs: 700 });

    expect(p.offer('Sold 1.2 t of TBS.', 'info', 1000, 3, 3)).toBe('show');
    expect(p.offer('Ripe: block 12.', 'info', 1100, 3, 3)).toBe('drop');
    expect(p.offer('Ripe: block 12.', 'info', 1900, 3, 3)).toBe('show');
  });

  it('counts the same words again rather than saying them twice', () => {
    const p = new ToastPolicy({ minGapMs: 700 });

    expect(p.offer('Ripe: block 12.', 'info', 1000, 1, 3)).toBe('show');
    expect(p.offer('Ripe: block 12.', 'info', 1200, 1, 3)).toBe('repeat');
    expect(p.offer('Ripe: block 12.', 'info', 5000, 1, 3)).toBe('repeat');
  });

  it('never drops a warning or an error: a fire is worth interrupting for', () => {
    const p = new ToastPolicy({ minGapMs: 700 });

    expect(p.offer('Sold 1.2 t of TBS.', 'info', 1000, 3, 3)).toBe('show');
    expect(p.offer('Fire spread to block 9.', 'warn', 1010, 3, 3)).toBe('show');
    expect(p.offer('Wildfire.', 'error', 1020, 3, 3)).toBe('show');
  });

  it('forgets words once they are old, so a later one reads as new', () => {
    const p = new ToastPolicy({ minGapMs: 700, repeatWindowMs: 4500 });

    expect(p.offer('Ripe: block 12.', 'info', 1000, 1, 3)).toBe('show');
    expect(p.offer('Ripe: block 12.', 'info', 9000, 1, 3)).toBe('show');
  });

  it('a notice taken off the screen stops counting as recent', () => {
    const p = new ToastPolicy({ minGapMs: 700 });

    expect(p.offer('Saved.', 'info', 1000, 1, 3)).toBe('show');
    p.forgetText('Saved.');
    expect(p.offer('Saved.', 'info', 2000, 1, 3)).toBe('show');
  });
});
