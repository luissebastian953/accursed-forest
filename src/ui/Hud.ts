/**
 * Top bar and time controls (§8 panels 1–2, 5–8). lit-html templates, patched
 * on change; no framework.
 */

import { html, nothing, render } from 'lit-html';
import { classMap } from 'lit-html/directives/class-map.js';

import { SPEEDS, type Speed } from '@app/timeControl';
import type { ClimateRegime } from '@sim/types';

import { formatDate, formatRp } from './format.ts';

/** One chip in the active-events strip (§8 panel 6). */
export interface EventChip {
  id: string;
  label: string;
  /** Days left, or null for events that last as long as their cause. */
  daysLeft: number | null;
  tone: 'fire' | 'smoke' | 'ash' | 'water' | 'dry' | 'pest' | 'econ';
}

export interface HudView {
  cash: number;
  tick: number;
  tbsPrice: number;
  /** -1 falling, 0 flat, 1 rising, against ~10 days ago. */
  tbsTrend: -1 | 0 | 1;
  regime: ClimateRegime;
  rain: number;
  speed: Speed;
  locked: boolean;
  estateCode: string;
  backend: 'webgpu' | 'webgl';
  saveNote: string | null;
  saveError: string | null;
  /** §8 panel 5: shown once any burn has happened. */
  firePressure: number;
  fireThreshold: number;
  burningCount: number;
  wildfire: boolean;
  /** §8 panel 5b: shown only once the first letter has arrived (§3.9); null hides it. */
  attention: number | null;
  /** §8 panel 1: the input price index, shown once it moves off 1. */
  inputIndex: number;
  /** §8 panel 1: share of forest across the estate's neighbourhood, 0..1. */
  forestCover: number;
  /** §8 panel 6: haze, ash, flood, drought, wildfire, plague. */
  events: EventChip[];
  /** §8 panel 19: ISPO conditions met, from Year 3; null hides the button. */
  ispoMet: number | null;
}

export interface HudHandlers {
  setSpeed(speed: Speed): void;
  openMenu(): void;
  openCertificate(): void;
  openHelp(): void;
}

const REGIME_LABEL: Record<ClimateRegime, string> = {
  normal: 'Normal year',
  elNino: 'El Niño',
  laNina: 'La Niña',
};

const SPEED_LABEL: Record<Speed, string> = { 0: '⏸', 1: '1×', 5: '5×', 20: '20×' };

const TONE: Record<EventChip['tone'], string> = {
  fire: 'bg-orange-700/80',
  smoke: 'bg-amber-900/75',
  ash: 'bg-neutral-600/80',
  water: 'bg-sky-800/80',
  dry: 'bg-yellow-800/75',
  pest: 'bg-red-800/80',
  econ: 'bg-sky-800/80',
};

export class Hud {
  private readonly root: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly handlers: HudHandlers,
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-1.5 p-3';
    parent.appendChild(this.root);
  }

  update(view: HudView): void {
    const weather = view.rain > 0.6 ? '🌧' : view.rain > 0.25 ? '🌦' : '☀️';
    const cover = Math.round(view.forestCover * 100);
    render(
      html`
        <div
          class="pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-black/60 px-5 py-2.5 text-sm text-white shadow-lg backdrop-blur"
        >
          <div class="font-semibold tabular-nums" data-testid="hud-cash">
            ${formatRp(view.cash)}
          </div>
          <div class="tabular-nums opacity-90" data-testid="hud-date">${formatDate(view.tick)}</div>
          <div class="tabular-nums opacity-90" title="TBS price today" data-testid="hud-price">
            ${formatRp(view.tbsPrice)}/kg
            <span
              class=${view.tbsTrend > 0 ? 'text-emerald-300' : view.tbsTrend < 0 ? 'text-red-300' : 'opacity-60'}
            >
              ${view.tbsTrend > 0 ? '▲' : view.tbsTrend < 0 ? '▼' : '▬'}
            </span>
          </div>
          <div class="opacity-90" title=${REGIME_LABEL[view.regime]} data-testid="hud-regime">
            ${weather} ${REGIME_LABEL[view.regime]}
          </div>
          <div
            class=${cover < 25 ? 'tabular-nums text-amber-300' : 'tabular-nums opacity-90'}
            title="Forest cover around the estate — forest holds the slopes when the rains come"
            data-testid="hud-forest"
          >
            🌳 ${cover}%
          </div>
          ${
            view.inputIndex > 1.005
              ? html`<div
                  class="tabular-nums text-sky-200/90"
                  title="Input prices against the start of the run"
                  data-testid="hud-inputs"
                >
                  inputs ×${view.inputIndex.toFixed(2)}
                </div>`
              : nothing
          }
          ${
            view.attention !== null
              ? html`
                  <div
                    class="flex items-center gap-2"
                    title="Attention from the authorities — a letter at 40, police at 70, arrest at 100"
                    data-testid="attention-gauge"
                  >
                    <span>👁</span>
                    <div class="relative h-2 w-20 overflow-hidden rounded bg-white/15">
                      <div
                        class=${view.attention >= 70 ? 'h-full bg-red-500' : view.attention >= 40 ? 'h-full bg-amber-400' : 'h-full bg-slate-300'}
                        style=${`width: ${Math.min(100, view.attention)}%`}
                      ></div>
                      <div class="absolute inset-y-0 left-[40%] w-px bg-white/60"></div>
                      <div class="absolute inset-y-0 left-[70%] w-px bg-white/60"></div>
                    </div>
                    <span class="text-xs tabular-nums opacity-80"
                      >${Math.round(view.attention)}</span
                    >
                  </div>
                `
              : nothing
          }
          ${
            view.firePressure > 0.01 || view.wildfire
              ? html`
                  <div
                    class="flex items-center gap-2"
                    title="Fire pressure — past the line the fire is no longer yours"
                    data-testid="fire-gauge"
                  >
                    <span>🔥</span>
                    <div class="relative h-2 w-20 overflow-hidden rounded bg-white/15">
                      <div
                        class=${
                          view.wildfire || view.firePressure > view.fireThreshold
                            ? 'h-full bg-red-500'
                            : view.firePressure > view.fireThreshold * 0.6
                              ? 'h-full bg-amber-400'
                              : 'h-full bg-emerald-400'
                        }
                        style=${`width: ${Math.min(100, (view.firePressure / view.fireThreshold) * 100)}%`}
                      ></div>
                      <div class="absolute inset-y-0 right-0 w-px bg-white/70"></div>
                    </div>
                    <span class="text-xs tabular-nums opacity-80"
                      >${view.firePressure.toFixed(1)}</span
                    >
                    ${
                      view.wildfire
                        ? html`<span
                            class="rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold"
                            data-testid="wildfire-badge"
                            >WILDFIRE</span
                          >`
                        : nothing
                    }
                  </div>
                `
              : nothing
          }
          ${
            view.burningCount > 0
              ? html`<span
                  class="rounded bg-orange-700/80 px-2 py-0.5 text-xs font-medium"
                  data-testid="burning-chip"
                >
                  burning: ${view.burningCount} block${view.burningCount === 1 ? '' : 's'}
                </span>`
              : nothing
          }
          ${
            view.ispoMet !== null
              ? html`<button
                  class=${`rounded px-2 py-0.5 text-xs font-medium ${view.ispoMet === 5 ? 'bg-emerald-700' : 'bg-white/10 hover:bg-white/20'}`}
                  title="ISPO certificate progress"
                  data-testid="hud-ispo"
                  @click=${() => this.handlers.openCertificate()}
                >
                  📜 ISPO ${view.ispoMet}/5
                </button>`
              : nothing
          }

          <div class="flex items-center gap-1" role="group" aria-label="Sim speed">
            ${SPEEDS.map(
              (speed) => html`
                <button
                  class=${classMap({
                    rounded: true,
                    'px-2': true,
                    'py-1': true,
                    'font-medium': true,
                    'transition-colors': true,
                    'bg-emerald-600': view.speed === speed,
                    'text-white': view.speed === speed,
                    'bg-white/10': view.speed !== speed,
                    'hover:bg-white/20': view.speed !== speed,
                    'cursor-not-allowed': view.locked && speed > 1,
                    'opacity-40': view.locked && speed > 1,
                  })}
                  ?disabled=${view.locked && speed > 1}
                  data-testid=${`speed-${speed}`}
                  @click=${() => this.handlers.setSpeed(speed)}
                >
                  ${SPEED_LABEL[speed]}
                </button>
              `,
            )}
            ${
              view.locked
                ? html`<span
                    class="ml-1 text-amber-300"
                    title="Speed locked to 1× while anything burns"
                    >🔥 1×</span
                  >`
                : nothing
            }
          </div>

          <div class="flex items-center gap-3 text-xs opacity-70">
            <span title="Estate code — share it to replay this world">${view.estateCode}</span>
            <span class="rounded bg-white/10 px-1.5 py-0.5 uppercase">${view.backend}</span>
            ${
              view.saveError
                ? html`<span class="text-red-300" title=${view.saveError}>save failed</span>`
                : view.saveNote
                  ? html`<span>${view.saveNote}</span>`
                  : nothing
            }
          </div>

          <button
            class="rounded bg-white/10 px-2.5 py-1 font-medium hover:bg-white/20"
            title="Controls (H)"
            aria-label="Controls"
            data-testid="help-button"
            @click=${() => this.handlers.openHelp()}
          >
            ?
          </button>

          <button
            class="rounded bg-white/10 px-2.5 py-1 font-medium hover:bg-white/20"
            data-testid="menu-button"
            @click=${() => this.handlers.openMenu()}
          >
            Menu
          </button>
        </div>

        ${
          view.events.length > 0
            ? html`
                <div
                  class="pointer-events-auto flex flex-wrap justify-center gap-1.5"
                  data-testid="events-strip"
                >
                  ${view.events.map(
                    (chip) => html`
                      <span
                        class=${`rounded-full px-2.5 py-0.5 text-xs font-medium text-white shadow ${TONE[chip.tone]}`}
                        data-testid=${`event-chip-${chip.id}`}
                      >
                        ${chip.label}${chip.daysLeft !== null ? html` · <span class="tabular-nums">${chip.daysLeft} d</span>` : nothing}
                      </span>
                    `,
                  )}
                </div>
              `
            : nothing
        }
      `,
      this.root,
    );
  }

  dispose(): void {
    this.root.remove();
  }
}
