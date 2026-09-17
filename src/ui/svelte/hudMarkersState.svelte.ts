/**
 * The pin layer (design kit 6a): a marker over the hectare a thing is
 * happening on. The Kopdes carries one so the workshop is findable from
 * anywhere; a block carries one when Ganoderma or the beetles have got into
 * it, so an infestation is visible without opening every block.
 *
 * The App projects the world positions each frame and hands them over; the
 * markers themselves know nothing about the camera.
 */

import { mount, unmount, type Component } from 'svelte';

import type { BlockId } from '@sim/types';

import HudMarkersView from './HudMarkers.svelte';

export type HudMarkerKind = 'workshop' | 'ganoderma' | 'beetle';

/** The pin art and the colour its label pill borrows, by kind. */
export const MARKER_LOOK: Record<HudMarkerKind, { pin: string; ring: string }> = {
  workshop: { pin: `${import.meta.env.BASE_URL}hud/hud-pin-workshop.svg`, ring: '#7a6440' },
  ganoderma: { pin: `${import.meta.env.BASE_URL}hud/hud-pin-ganoderma.svg`, ring: '#6b3a8a' },
  beetle: { pin: `${import.meta.env.BASE_URL}hud/hud-pin-beetle.svg`, ring: '#9e2e20' },
};

export interface HudMarker {
  /** Stable per block and kind, so a marker is not rebuilt every frame. */
  id: string;
  kind: HudMarkerKind;
  block: BlockId;
  /** Screen position of the hectare's centre, in CSS pixels. */
  x: number;
  y: number;
  label: string;
  detail: string;
  alert: boolean;
}

export interface HudMarkerHandlers {
  /** Clicking a pin selects its block, the way clicking the land does. */
  select(block: BlockId): void;
}

export class HudMarkers {
  items = $state.raw<HudMarker[]>([]);
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: HudMarkerHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(HudMarkersView, { target: this.target, props: { markers: this } });
  }

  update(items: HudMarker[]): void {
    if (items.length === 0 && this.items.length === 0) return;
    this.items = items;
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
