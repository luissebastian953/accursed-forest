/**
 * Controls (§8 panel 4): which button does what, in a popover from the top
 * bar's "?" button or the H key.
 */

import { html, nothing, render } from 'lit-html';

const MOUSE: readonly (readonly [string, string])[] = [
  ['Click', 'Select a block and open its panel'],
  ['Double-click', 'Select and move the camera to it'],
  ['Drag', 'Pan the map'],
  ['Scroll', 'Zoom in and out'],
];

const KEYS: readonly (readonly [string, string])[] = [
  ['Space', 'Pause / resume'],
  ['1  2  3', 'Speed 1× · 5× · 20×'],
  ['Q  E', 'Turn the view'],
  ['F', 'Jump to the Kopdes'],
  ['K', 'Kopdes shop'],
  ['N', 'News feed'],
  ['H', 'This help'],
  ['Esc', 'Close panels'],
];

export interface ControlsHelpHandlers {
  close(): void;
}

export class ControlsHelp {
  private readonly root: HTMLElement;
  private open = false;

  constructor(
    parent: HTMLElement,
    private readonly handlers: ControlsHelpHandlers,
  ) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  show(): void {
    this.open = true;
    this.render();
  }

  hide(): void {
    this.open = false;
    this.render();
  }

  dispose(): void {
    this.root.remove();
  }

  private rows(rows: readonly (readonly [string, string])[]) {
    return rows.map(
      ([key, what]) => html`
        <li class="flex items-baseline gap-3">
          <kbd
            class="min-w-[5.5rem] shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-center font-mono text-xs"
            >${key}</kbd
          >
          <span class="opacity-85">${what}</span>
        </li>
      `,
    );
  }

  private render(): void {
    if (!this.open) {
      render(nothing, this.root);
      return;
    }
    render(
      html`
        <div
          class="absolute left-3 top-24 z-30 w-[min(20rem,calc(100%-1.5rem))] rounded-xl bg-stone-900/95 p-4 text-sm text-white shadow-2xl backdrop-blur"
          data-testid="controls-help"
        >
          <div class="mb-2 flex items-center justify-between">
            <div class="font-semibold">Controls</div>
            <button
              class="rounded px-2 py-0.5 hover:bg-white/10"
              data-testid="controls-help-close"
              @click=${() => this.handlers.close()}
            >
              ✕
            </button>
          </div>
          <div class="mb-1 text-xs uppercase tracking-wide opacity-60">Mouse</div>
          <ul class="mb-3 space-y-1">
            ${this.rows(MOUSE)}
          </ul>
          <div class="mb-1 text-xs uppercase tracking-wide opacity-60">Keyboard</div>
          <ul class="mb-3 space-y-1">
            ${this.rows(KEYS)}
          </ul>
          <p class="text-xs leading-relaxed opacity-60">
            Start by clicking the bare brown block: build the Kopdes there, then chop or burn a
            block, buy bibit, plant, and harvest when the palms bear.
          </p>
        </div>
      `,
      this.root,
    );
  }
}
