import { compact } from '@shared/compact';
import { GROWTH } from '@sim/balance/growth';

import { t } from '../i18n/index.ts';

const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const kilos = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

export function formatRp(amount: number): string {
  return `Rp ${rupiah.format(Math.round(amount))}`;
}

/** Rupiah for a narrow column: Rp 536.4M rather than Rp 536.364.555. */
export function formatRpCompact(amount: number): string {
  return `Rp ${compact(amount)}`;
}

export function formatKg(kilograms: number): string {
  return `${kilos.format(Math.round(kilograms))} kg`;
}

/** A year of fruit in tonnes, where kilograms would run to six digits. */
export function formatTonnes(kilograms: number): string {
  return t('format.tonnes', { n: (kilograms / 1000).toFixed(1) });
}

function calendar(tick: number): { year: number; day: number } {
  return {
    year: Math.floor(tick / GROWTH.daysPerYear) + 1,
    day: (tick % GROWTH.daysPerYear) + 1,
  };
}

export function formatDate(tick: number): string {
  return t('format.date', calendar(tick));
}

/** The phone's status bar: the date squeezed to a few characters. */
export function formatDateShort(tick: number): string {
  return t('format.dateShort', calendar(tick));
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
