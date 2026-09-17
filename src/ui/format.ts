/** Formatting helpers shared by the panels. Sim time is an integer tick (§10.2). */

import { GROWTH } from '@sim/balance/growth';

import { t } from '../i18n/index.ts';

const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const kilos = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

export function formatRp(amount: number): string {
  return `Rp ${rupiah.format(Math.round(amount))}`;
}

export function formatKg(kilograms: number): string {
  return `${kilos.format(Math.round(kilograms))} kg`;
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
