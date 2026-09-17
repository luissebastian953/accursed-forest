/**
 * What the workbench panel shows, and the handful of things it can ask the
 * stage to do. The stage (`Workbench.ts`) owns the renderer and hands this a
 * fresh view whenever something changes; the panel only reads it.
 */

import { mount, unmount, type Component } from 'svelte';

import { ACTIONS, type ActionId, type Subject } from './subjects.ts';
import WorkbenchPanelView from './WorkbenchPanel.svelte';

/** A backdrop to judge a model against. Emission needs the dark ones. */
export interface Backdrop {
  id: string;
  label: string;
  /** Scene background. `null` keeps the game's own sky and fog. */
  colour: number | null;
  /** A swatch the panel can paint the button with. */
  swatch: string;
}

export const BACKDROPS: readonly Backdrop[] = [
  { id: 'sky', label: 'Game sky', colour: null, swatch: '#9fc2d4' },
  { id: 'night', label: 'Night', colour: 0x0b0f14, swatch: '#0b0f14' },
  { id: 'black', label: 'Black', colour: 0x000000, swatch: '#000000' },
  { id: 'slate', label: 'Slate', colour: 0x3a4450, swatch: '#3a4450' },
  { id: 'paper', label: 'Paper', colour: 0xfff6e0, swatch: '#fff6e0' },
  { id: 'white', label: 'White', colour: 0xffffff, swatch: '#ffffff' },
  { id: 'chroma', label: 'Chroma', colour: 0x00b140, swatch: '#00b140' },
];

/** What the renderer is holding, refreshed a few times a second. */
export interface StageStats {
  backend: string;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  /** Everything the renderer is holding on the GPU, in bytes. */
  bytes: number;
  /** Frames per second over the last second. */
  fps: number;
}

export interface WorkbenchHandlers {
  select(subject: string): void;
  run(action: ActionId): void;
  setBackdrop(id: string): void;
  setGrid(on: boolean): void;
  setSpin(on: boolean): void;
}

export class WorkbenchPanel {
  readonly subjects: readonly Subject[];
  selected = $state('');
  /** Which of the shared actions the subject on the stage implements. */
  available = $state.raw<readonly ActionId[]>([]);
  backdrop = $state(BACKDROPS[0]!.id);
  grid = $state(true);
  spin = $state(false);
  stats = $state.raw<StageStats | null>(null);
  /** What went wrong building the subject, if anything did. */
  error = $state<string | null>(null);

  readonly actions = ACTIONS;
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    subjects: readonly Subject[],
    readonly handlers: WorkbenchHandlers,
  ) {
    this.subjects = subjects;
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(WorkbenchPanelView, { target: this.target, props: { panel: this } });
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
