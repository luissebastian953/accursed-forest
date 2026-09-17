/**
 * The cartoon smartphone (design kit, phone-frame asset) that the news feed
 * and the Kopdes shop both live on. The frame body sits under the screen,
 * the notch and home bar over it; the screen is the 400×840 safe zone of the
 * 480×920 frame, with a status bar either side of the notch, a header, a
 * scrolling body and an optional footer above the home bar.
 */

import { html, nothing, type TemplateResult } from 'lit-html';

import { formatDate } from './format.ts';

const FRAME_URL = `${import.meta.env.BASE_URL}ui/phone-frame.svg`;
const FRAME_TOP_URL = `${import.meta.env.BASE_URL}ui/phone-frame-top.svg`;

/** Where a phone stands on the stage: between the HUD and the ticker, on the left. */
export const PHONE_PLACEMENT =
  'absolute bottom-16 left-3 top-[15.25rem] z-20 aspect-[480/920] max-h-[920px] max-w-[calc(100vw-1.5rem)]';

export interface PhoneShell {
  testId: string;
  /** The sim tick, for the status bar's date. */
  tick: number;
  header: TemplateResult;
  body: TemplateResult;
  footer?: TemplateResult;
}

export function phoneShell(shell: PhoneShell): TemplateResult {
  const date = formatDate(shell.tick).replace('Year ', 'Y').replace(' · Day ', ' · D');
  return html`
    <div class=${`@container ${PHONE_PLACEMENT}`} data-testid=${shell.testId}>
      <img class="absolute inset-0 h-full w-full select-none" src=${FRAME_URL} alt="" />

      <div
        class="absolute bottom-[4.35%] left-[8.33%] right-[8.33%] top-[4.35%] flex flex-col overflow-hidden rounded-[8.75cqw] text-sm"
      >
        <!-- Status bar, either side of the notch -->
        <div
          class="flex items-center justify-between px-[6%] pb-1 pt-[2.2%] text-[0.7rem] font-extrabold text-[#8f7a52]"
        >
          <span class="num">${date}</span>
          <span class="flex items-center gap-1.5" aria-hidden="true">
            <span class="flex items-end gap-px">
              <i class="block h-1.5 w-1 rounded-sm bg-[#8f7a52]"></i>
              <i class="block h-2.5 w-1 rounded-sm bg-[#8f7a52]"></i>
              <i class="block h-3.5 w-1 rounded-sm bg-[#8f7a52]"></i>
            </span>
            <span
              class="relative ml-1 block h-3 w-6 rounded-[4px] border-2 border-[#8f7a52] after:absolute after:-right-[5px] after:top-[2px] after:h-1 after:w-[3px] after:rounded-r-sm after:bg-[#8f7a52]"
            >
              <i class="absolute inset-[2px] right-[3px] block rounded-[2px] bg-[var(--green)]"></i>
            </span>
          </span>
        </div>

        ${shell.header}

        <div class="min-h-0 flex-1 overflow-y-auto px-[6%] py-3">${shell.body}</div>

        ${shell.footer ? html`<div class="px-[6%] pb-[6%] pt-2">${shell.footer}</div>` : html`<div class="pb-[5%]"></div>`}
      </div>

      <img
        class="pointer-events-none absolute inset-0 h-full w-full select-none"
        src=${FRAME_TOP_URL}
        alt=""
      />
    </div>
  `;
}

/** The phone's header row: an icon tile, a title, optional extras, and the close button. */
export function phoneHeader(options: {
  tile: TemplateResult;
  title: string;
  extra?: TemplateResult | undefined;
  subtitle?: TemplateResult | undefined;
  closeTestId: string;
  onClose: () => void;
}): TemplateResult {
  return html`
    <div class="flex items-center gap-3 px-[6%] pb-2 pt-1">
      <span
        class="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border-2 border-[var(--coral-edge)] bg-[var(--coral)] shadow-[0_3px_0_var(--coral-edge)]"
      >
        ${options.tile}
      </span>
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-2xl font-extrabold leading-none">${options.title}</span>
          ${options.extra ?? nothing}
        </div>
        ${options.subtitle ?? nothing}
      </div>
      <button
        class="btn btn-close ml-auto !h-11 !w-11 !rounded-2xl !text-lg"
        aria-label="Close"
        data-testid=${options.closeTestId}
        @click=${options.onClose}
      >
        ✕
      </button>
    </div>
  `;
}
