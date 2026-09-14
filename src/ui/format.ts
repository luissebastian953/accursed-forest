/** Formatting helpers shared by the panels. Sim time is an integer tick (§10.2). */

import { GROWTH } from '@sim/balance/growth';

const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const kilos = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

export function formatRp(amount: number): string {
  return `Rp ${rupiah.format(Math.round(amount))}`;
}

export function formatKg(kilograms: number): string {
  return `${kilos.format(Math.round(kilograms))} kg`;
}

export function formatDate(tick: number): string {
  const year = Math.floor(tick / GROWTH.daysPerYear) + 1;
  const day = (tick % GROWTH.daysPerYear) + 1;
  return `Year ${year} · Day ${day}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
