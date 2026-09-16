/**
 * Top bar and time controls (§8 panels 1–2, 5–8), in the cartoon kit: one
 * cream card of pills, icons from `icons.ts`, and chunky buttons.
 */

import { html, nothing, render } from 'lit-html';

import { FIRE_LOCK_SPEED, SPEEDS, type Speed } from '@app/timeControl';
import type { ClimateRegime } from '@sim/types';

import { formatDate, formatRp } from './format.ts';
import { icon, type IconName } from './icons.ts';

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

const SPEED_LABEL: Record<Speed, string> = { 0: '‖', 1: '1×', 5: '5×', 20: '20×' };

const CHIP_TONE: Record<EventChip['tone'], string> = {
  fire: 'chip-fire',
  smoke: 'chip-smoke',
  ash: 'chip-ash',
  water: 'chip-water',
  dry: 'chip-dry',
  pest: 'chip-pest',
  econ: 'chip-econ',
};

/** Which icon a chip carries, by event id. */
const CHIP_ICON: Record<string, IconName> = {
  wildfire: 'fire',
  haze: 'haze',
  ash: 'haze',
  flood: 'rain',
  drought: 'sun',
  plague: 'beetle',
  investigation: 'police-warning',
  ban: 'police-warning',
  insolvent: 'coin',
  millStrike: 'mill-strike',
};

export class Hud {
  private readonly root: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly handlers: HudHandlers,
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 p-3';
    parent.appendChild(this.root);
  }

  update(view: HudView): void {
    const cover = Math.round(view.forestCover * 100);
    const rainy = view.rain > 0.45;
    render(
      html`
        <div
          class="card pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5"
        >
          <div class="cash num" data-testid="hud-cash">
            ${icon('coin')}<span>${formatRp(view.cash)}</span>
          </div>

          <div class="pill flex items-center gap-1.5" data-testid="hud-date">
            ${icon('calendar')}<span class="num text-sm">${formatDate(view.tick)}</span>
          </div>

          <div
            class="flex items-center gap-1.5 text-sm"
            title="TBS price today"
            data-testid="hud-price"
          >
            ${icon('tbs-fruit')}
            <span class="num">${formatRp(view.tbsPrice)}/kg</span>
            <span
              class=${view.tbsTrend > 0 ? 'text-[#3faa4c]' : view.tbsTrend < 0 ? 'text-[#e04a3a]' : 'muted'}
              >${view.tbsTrend > 0 ? '▲' : view.tbsTrend < 0 ? '▼' : '▬'}</span
            >
          </div>

          <div class="flex items-center gap-1.5 text-sm" data-testid="hud-regime">
            ${icon(rainy ? 'rain' : 'sun')}<span>${REGIME_LABEL[view.regime]}</span>
          </div>

          <div
            class="flex items-center gap-1.5 text-sm"
            title="Forest cover around the estate — forest holds the slopes when the rains come"
            data-testid="hud-forest"
          >
            ${icon('forest-cover')}
            <span class=${cover < 25 ? 'num text-[#b85e12]' : 'num'}>${cover}%</span>
          </div>

          ${
            view.inputIndex > 1.005
              ? html`<div
                  class="pill-muted num text-xs"
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
                    ${icon('eye-attention')}
                    <span class="gauge">
                      <i
                        style=${`width: ${Math.min(100, view.attention)}%; --gauge-from: ${view.attention >= 70 ? '#ef6a58' : view.attention >= 40 ? '#ffb03a' : '#cbbb9a'}; --gauge-to: ${view.attention >= 70 ? '#e04a3a' : view.attention >= 40 ? '#f28b2b' : '#a08a5e'}`}
                      ></i>
                    </span>
                    <span class="num text-xs muted">${Math.round(view.attention)}</span>
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
                    ${icon('fire')}
                    <span class="gauge">
                      <i
                        style=${`width: ${Math.min(100, (view.firePressure / view.fireThreshold) * 100)}%; --gauge-from: ${view.wildfire || view.firePressure > view.fireThreshold ? '#ef6a58' : view.firePressure > view.fireThreshold * 0.6 ? '#ffb03a' : '#5fd06a'}; --gauge-to: ${view.wildfire || view.firePressure > view.fireThreshold ? '#e04a3a' : view.firePressure > view.fireThreshold * 0.6 ? '#f28b2b' : '#3faa4c'}`}
                      ></i>
                    </span>
                    <span class="num text-xs muted">${view.firePressure.toFixed(1)}</span>
                    ${
                      view.wildfire
                        ? html`<span class="chip chip-fire" data-testid="wildfire-badge"
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
              ? html`<span class="chip chip-fire" data-testid="burning-chip">
                  burning: ${view.burningCount} block${view.burningCount === 1 ? '' : 's'}
                </span>`
              : nothing
          }
          ${
            view.ispoMet !== null
              ? html`<button
                  class=${`btn btn-sm ${view.ispoMet === 5 ? 'btn-green' : 'btn-ghost'}`}
                  title="ISPO certificate progress"
                  data-testid="hud-ispo"
                  @click=${() => this.handlers.openCertificate()}
                >
                  ${icon('certificate-ispo')} ISPO ${view.ispoMet}/5
                </button>`
              : nothing
          }

          <div class="flex items-center gap-1" role="group" aria-label="Sim speed">
            ${SPEEDS.map(
              (speed) => html`
                <button
                  class=${`btn btn-sm ${view.speed === speed ? 'btn-green' : 'btn-ghost'}`}
                  ?disabled=${view.locked && speed > FIRE_LOCK_SPEED}
                  data-testid=${`speed-${speed}`}
                  @click=${() => this.handlers.setSpeed(speed)}
                >
                  ${speed === 0 ? icon('pause') : SPEED_LABEL[speed]}
                </button>
              `,
            )}
            ${
              view.locked
                ? html`<span
                    class="chip chip-fire"
                    title=${`Speed capped at ${FIRE_LOCK_SPEED}× while anything burns`}
                    >${icon('fire')} ${FIRE_LOCK_SPEED}×</span
                  >`
                : nothing
            }
          </div>

          <div class="label flex items-center gap-2">
            <span title="Estate code — share it to replay this world">${view.estateCode}</span>
            <span class="pill-muted px-1.5 py-0.5">${view.backend}</span>
            ${
              view.saveError
                ? html`<span class="text-[#e04a3a]" title=${view.saveError}>save failed</span>`
                : view.saveNote
                  ? html`<span>${view.saveNote}</span>`
                  : nothing
            }
          </div>

          <button
            class="btn btn-sm btn-ghost"
            title="Controls (H)"
            aria-label="Controls"
            data-testid="help-button"
            @click=${() => this.handlers.openHelp()}
          >
            ?
          </button>

          <button
            class="btn btn-sm btn-coral"
            data-testid="menu-button"
            @click=${() => this.handlers.openMenu()}
          >
            MENU
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
                        class=${`chip ${CHIP_TONE[chip.tone]}`}
                        data-testid=${`event-chip-${chip.id}`}
                      >
                        ${CHIP_ICON[chip.id] ? icon(CHIP_ICON[chip.id]!) : nothing}
                        ${chip.label}${
                          chip.daysLeft !== null
                            ? html` · <span class="num">${chip.daysLeft} d</span>`
                            : nothing
                        }
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
