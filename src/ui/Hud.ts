/**
 * Top bar and time controls (§8 panels 1–2, 5–8), in the cartoon kit: one
 * cream card of pills, icons from `icons.ts`, and chunky buttons.
 */

import { html, nothing, render } from 'lit-html';

import { FIRE_LOCK_SPEED, SPEEDS, type Speed } from '@app/timeControl';
import type { ClimateRegime, SkyCondition } from '@sim/types';

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
  /** Today's sky (§3.6): what the climate tile actually shows. */
  sky: SkyCondition;
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

const SKY_LABEL: Record<SkyCondition, string> = {
  clear: 'Sunny',
  cloudy: 'Cloudy',
  rain: 'Rain',
  storm: 'Thunderstorm',
};

const SKY_ICON: Record<SkyCondition, IconName> = {
  clear: 'sun',
  cloudy: 'haze',
  rain: 'rain',
  storm: 'rain',
};

const SPEED_LABEL: Record<Speed, string> = {
  0: 'Pause',
  1: '1× Normal',
  10: '10× Fast',
  50: '50× Skip',
};

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

interface Tile {
  icon: IconName;
  label: string;
  value: unknown;
  tone?: 'plain' | 'gold' | 'danger';
  /** Pins a pinging ! to the tile: something needs the player now. */
  alert?: boolean;
  testId: string;
  title?: string | undefined;
  /** A quieter second line, for the regime under the sky. */
  note?: string;
}

/** One read-out in the top bar: icon, label, value — and an alert when it bites. */
function tile(t: Tile) {
  const tone = t.tone === 'gold' ? 'hud-tile-gold' : t.tone === 'danger' ? 'hud-tile-danger' : '';
  return html`
    <div class=${`hud-tile ${tone}`} data-testid=${t.testId} title=${t.title ?? nothing}>
      ${icon(t.icon)}
      <div>
        <div class="label">${t.label}</div>
        <div class="hud-value">${t.value}</div>
        ${t.note ? html`<div class="label">${t.note}</div>` : nothing}
      </div>
      ${t.alert ? html`<span class="ping" data-testid=${`${t.testId}-alert`}>!</span>` : nothing}
    </div>
  `;
}

export class Hud {
  private readonly root: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly handlers: HudHandlers,
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'ui-slide chrome-right pointer-events-none absolute left-0 top-0 z-10 flex flex-col items-start gap-2 p-3';
    parent.appendChild(this.root);
  }

  /** Slide the bar up out of the way (the title screens) and back. */
  setHidden(hidden: boolean): void {
    this.root.classList.toggle('ui-hidden-top', hidden);
  }

  update(view: HudView): void {
    const cover = Math.round(view.forestCover * 100);
    const inDebt = view.cash < 0;
    const fireOver = view.wildfire || view.firePressure > view.fireThreshold;
    const trendClass =
      view.tbsTrend > 0 ? 'text-[#3faa4c]' : view.tbsTrend < 0 ? 'text-[#e04a3a]' : 'muted';

    render(
      html`
        <div
          class="card pointer-events-auto flex flex-col items-start gap-2 px-5 py-3"
          data-testid="hud"
        >
          <div class="flex flex-wrap items-center justify-start gap-2.5">
            ${tile({
              icon: 'coin',
              label: inDebt ? 'Cash · in debt' : 'Cash',
              value: html`${formatRp(view.cash)}`,
              tone: inDebt ? 'danger' : 'gold',
              alert: inDebt,
              testId: 'hud-cash',
              title: inDebt
                ? 'In the red. The bank calls the loans if it stays that way.'
                : undefined,
            })}
            ${tile({
              icon: 'calendar',
              label: 'Date',
              value: html`${formatDate(view.tick)}`,
              testId: 'hud-date',
            })}
            ${tile({
              icon: 'tbs-fruit',
              label: 'TBS price',
              value: html`${formatRp(view.tbsPrice)}<span class="text-sm">/kg</span>
                <span class=${trendClass}
                  >${view.tbsTrend > 0 ? '▲' : view.tbsTrend < 0 ? '▼' : '▬'}</span
                >`,
              testId: 'hud-price',
              title: 'What the Kopdes pays for fresh fruit bunches today',
            })}
            ${tile({
              icon: SKY_ICON[view.sky],
              label: 'Climate',
              value: html`${SKY_LABEL[view.sky]}`,
              note: REGIME_LABEL[view.regime],
              testId: 'hud-regime',
            })}
            ${tile({
              icon: 'forest-cover',
              label: 'Forest',
              value: html`<span class=${cover < 25 ? 'text-[#b85e12]' : ''}>${cover}%</span>`,
              testId: 'hud-forest',
              title: 'Forest cover around the estate — forest holds the slopes when the rains come',
            })}
            ${
              view.inputIndex > 1.005
                ? tile({
                    icon: 'coin',
                    label: 'Inputs',
                    value: html`×${view.inputIndex.toFixed(2)}`,
                    testId: 'hud-inputs',
                    title: 'Shop prices against the start of the run',
                  })
                : nothing
            }
            ${
              view.attention !== null
                ? tile({
                    icon: 'eye-attention',
                    label: 'Attention',
                    value: html`<span class="flex items-center gap-2">
                      <span class="gauge w-20"
                        ><i
                          style=${`width: ${Math.min(100, view.attention)}%; --gauge-from: ${view.attention >= 70 ? '#ef6a58' : view.attention >= 40 ? '#ffb03a' : '#cbbb9a'}; --gauge-to: ${view.attention >= 70 ? '#e04a3a' : view.attention >= 40 ? '#f28b2b' : '#a08a5e'}`}
                        ></i
                      ></span>
                      <span>${Math.round(view.attention)}</span>
                    </span>`,
                    tone: view.attention >= 70 ? 'danger' : 'plain',
                    alert: view.attention >= 70,
                    testId: 'attention-gauge',
                    title:
                      'Attention from the authorities — a letter at 40, police at 70, arrest at 100',
                  })
                : nothing
            }
            ${
              view.firePressure > 0.01 || view.wildfire
                ? tile({
                    icon: 'fire',
                    label: view.wildfire ? 'Fire · wildfire' : 'Fire',
                    value: html`<span class="flex items-center gap-2">
                      <span class="gauge w-20"
                        ><i
                          style=${`width: ${Math.min(100, (view.firePressure / view.fireThreshold) * 100)}%; --gauge-from: ${fireOver ? '#ef6a58' : view.firePressure > view.fireThreshold * 0.6 ? '#ffb03a' : '#5fd06a'}; --gauge-to: ${fireOver ? '#e04a3a' : view.firePressure > view.fireThreshold * 0.6 ? '#f28b2b' : '#3faa4c'}`}
                        ></i
                      ></span>
                      <span>${view.firePressure.toFixed(1)} / ${view.fireThreshold}</span>
                    </span>`,
                    tone: fireOver ? 'danger' : 'plain',
                    alert: fireOver,
                    testId: 'fire-gauge',
                    title: 'Fire pressure — past the line the fire is no longer yours',
                  })
                : nothing
            }
            ${
              view.burningCount > 0
                ? html`<span class="chip chip-fire" data-testid="burning-chip">
                    ${icon('fire')} burning: ${view.burningCount}
                    block${view.burningCount === 1 ? '' : 's'}
                  </span>`
                : nothing
            }
            ${
              view.wildfire
                ? html`<span class="chip chip-pest" data-testid="wildfire-badge">WILDFIRE</span>`
                : nothing
            }
          </div>

          <div class="flex flex-wrap items-center justify-start gap-2">
            <div
              class="pill-muted flex items-center gap-1.5 p-1"
              role="group"
              aria-label="Sim speed"
            >
              <span class="label px-1.5">Speed</span>
              ${SPEEDS.map(
                (speed) => html`
                  <button
                    class=${`btn btn-sm ${view.speed === speed ? 'btn-green' : 'btn-ghost'}`}
                    ?disabled=${view.locked && speed > FIRE_LOCK_SPEED}
                    data-testid=${`speed-${speed}`}
                    @click=${() => this.handlers.setSpeed(speed)}
                  >
                    ${speed === 0 ? icon('pause') : nothing}${SPEED_LABEL[speed]}
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

            ${
              view.ispoMet !== null
                ? html`<button
                    class=${`btn ${view.ispoMet === 5 ? 'btn-green' : 'btn-ghost'}`}
                    title="ISPO certificate progress"
                    data-testid="hud-ispo"
                    @click=${() => this.handlers.openCertificate()}
                  >
                    ${icon('certificate-ispo')} ISPO ${view.ispoMet}/5
                  </button>`
                : nothing
            }

            <button
              class="btn btn-ghost"
              title="Controls (H)"
              aria-label="Controls"
              data-testid="help-button"
              @click=${() => this.handlers.openHelp()}
            >
              ? Help
            </button>

            <button
              class="btn btn-coral"
              data-testid="menu-button"
              @click=${() => this.handlers.openMenu()}
            >
              MENU
            </button>

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
          </div>
        </div>

        ${
          view.events.length > 0
            ? html`
                <div
                  class="pointer-events-auto flex flex-wrap justify-start gap-1.5"
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
