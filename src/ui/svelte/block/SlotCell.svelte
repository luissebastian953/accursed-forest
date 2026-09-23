<script lang="ts">
  import Icon from '../base/Icon.svelte';
  import Tooltip from '../base/Tooltip.svelte';

  import type { SlotTip } from './blockPanelState.svelte.ts';

  interface Props {
    slot: number;
    cls: string;
    title: string;
    sick: boolean;
    fruit: boolean;
    tip: SlotTip;
    /** Place in the twelve-wide lattice, so edge bubbles stay inside the panel. */
    row: number;
    column: number;
    columns: number;
    pick(): void;
  }

  const { slot, cls, title, sick, fruit, tip, row, column, columns, pick }: Props = $props();
  const align = $derived(column < 2 ? 'start' : column >= columns - 2 ? 'end' : 'center');
  // The panel scrolls, and the top row has nothing above it to hang a bubble in.
  const placement = $derived(row === 0 ? 'bottom' : 'top');
</script>

{#snippet card()}
  <span class="flex items-center gap-2 px-0.5 py-0.5 text-left">
    <span class="tip-badge" data-tone={tip.tone}>
      {#if tip.icon}<Icon name={tip.icon} />{/if}
    </span>
    <span>
      <span class="label block leading-none">{tip.at}</span>
      <span class="block whitespace-nowrap text-[0.82rem] leading-tight">
        <span class="tip-head" data-tone={tip.tone}>{tip.head}</span><span
          class={tip.hot ? 'text-[#d94f2b]' : 'muted'}>{`, ${tip.figure}`}</span
        >
      </span>
    </span>
  </span>
{/snippet}

<Tooltip body={card} tone={tip.tone} withArrow {align} {placement} class="w-full">
  <button
    class="flex aspect-square w-full items-center justify-center rounded-[5px] {cls} {sick
      ? 'slot-alert'
      : ''}"
    aria-label={title}
    data-testid={`slot-cell-${slot}`}
    data-sick={sick || undefined}
    onclick={pick}
  >
    {#if sick}
      <span
        class="text-[11px] font-black leading-none {cls.includes('slot-dead')
          ? 'text-[#f2d9b0]'
          : 'text-[#7a2a12]'}"
        aria-hidden="true">!</span
      >
    {:else if fruit}
      <Icon name="tbs-fruit" class="h-3 w-3" />
    {/if}
  </button>
</Tooltip>
