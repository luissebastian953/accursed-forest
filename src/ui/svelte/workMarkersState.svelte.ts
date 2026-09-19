import { mount, unmount, type Component } from 'svelte';

import type { BlockId } from '@sim/types';

import WorkMarkersView from './WorkMarkers.svelte';

export interface WorkMarker {
  id: BlockId;
  /** Screen position, CSS pixels within the stage. */
  x: number;
  y: number;
  /** 0..1 */
  progress: number;
  kind: 'chop' | 'burn' | 'dig';
}

export class WorkMarkers {
  items = $state.raw<WorkMarker[]>([]);
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(parent: HTMLElement) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(WorkMarkersView, { target: this.target, props: { markers: this } });
  }

  update(items: WorkMarker[]): void {
    if (items.length === 0 && this.items.length === 0) return;
    this.items = items;
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
