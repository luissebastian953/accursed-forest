<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { TipTone } from './tooltip.ts';

  interface Props {
    /** The words in the bubble. Empty, and with no `body`, the tooltip is off. */
    text?: string;
    /** Richer contents than one line, rendered in place of `text`. */
    body?: Snippet;
    /** Which side of the child it sits on. */
    placement?: 'top' | 'bottom' | 'left' | 'right';
    /** The triangle pointing at the target. */
    withArrow?: boolean;
    /** Border colour: the state the bubble is talking about. */
    tone?: TipTone;
    /** Which end of the child a top or bottom bubble lines up with. */
    align?: 'center' | 'start' | 'end';
    /** Extra classes for the wrapper, e.g. `w-full` inside a stretched row. */
    class?: string;
    children: Snippet;
  }

  const {
    text = '',
    body,
    placement = 'top',
    withArrow = false,
    tone = 'sand',
    align = 'center',
    class: extraClass = '',
    children,
  }: Props = $props();
</script>

<span
  class="tip-wrap {extraClass}"
  data-placement={placement}
  data-align={align}
  data-tone={tone}
  data-testid="tooltip-wrap"
>
  {@render children()}
  {#if body || text}
    <!-- Not focusable, and hidden from the pointer: it must never eat a click. -->
    <span class="tip" role="tooltip" data-testid="tooltip">
      {#if body}{@render body()}{:else}{text}{/if}
    </span>
    {#if withArrow}
      <!-- A sibling of the bubble, so it points at the child whatever the align. -->
      <svg class="tip-arrow" viewBox="0 0 16 10" aria-hidden="true">
        <path d="M1.4 0.7 L8 8.3 L14.6 0.7" />
      </svg>
    {/if}
  {/if}
</span>

<style>
  .tip-wrap {
    --tip-gap: 0.5rem;
    --tip-face: #fffdf7;
    position: relative;
    display: inline-flex;
  }

  .tip-wrap[data-tone='sand'] {
    --tip-edge: #e0cfa4;
  }

  .tip-wrap[data-tone='green'] {
    --tip-edge: #7ab648;
  }

  .tip-wrap[data-tone='deep'] {
    --tip-edge: #2f6b2e;
  }

  .tip-wrap[data-tone='purple'] {
    --tip-edge: #5b2d90;
  }

  .tip-wrap[data-tone='grey'] {
    --tip-edge: #9a9186;
  }

  .tip-wrap[data-tone='ink'] {
    --tip-edge: #4a3320;
  }

  .tip,
  .tip-arrow {
    position: absolute;
    z-index: 30;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 120ms ease 0ms,
      visibility 0ms linear 120ms;
  }

  .tip {
    max-width: 15rem;
    width: max-content;
    background: var(--tip-face);
    color: var(--ink);
    border: 2px solid var(--tip-edge);
    border-radius: 14px;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.25;
    text-align: center;
    padding: 0.32rem 0.6rem;
    box-shadow: 0 3px 0 var(--tip-edge);
  }

  .tip-arrow {
    width: 16px;
    height: 10px;
    overflow: visible;
  }

  .tip-arrow path {
    fill: var(--tip-face);
    stroke: var(--tip-edge);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* The bubble waits out a passing pointer, then fades in (GDD 8 panel 9a). */
  .tip-wrap:hover .tip,
  .tip-wrap:hover .tip-arrow {
    opacity: 1;
    visibility: visible;
    transition:
      opacity 120ms ease 200ms,
      visibility 0ms linear 200ms;
  }

  .tip-wrap:focus-within .tip,
  .tip-wrap:focus-within .tip-arrow {
    opacity: 1;
    visibility: visible;
    transition: none;
  }

  .tip-wrap[data-placement='top'] .tip {
    bottom: 100%;
    margin-bottom: var(--tip-gap);
  }

  .tip-wrap[data-placement='bottom'] .tip {
    top: 100%;
    margin-top: var(--tip-gap);
  }

  .tip-wrap[data-placement='top'][data-align='center'] .tip,
  .tip-wrap[data-placement='bottom'][data-align='center'] .tip {
    left: 50%;
    translate: -50% 0;
  }

  .tip-wrap[data-placement='top'][data-align='start'] .tip,
  .tip-wrap[data-placement='bottom'][data-align='start'] .tip {
    left: -2px;
  }

  .tip-wrap[data-placement='top'][data-align='end'] .tip,
  .tip-wrap[data-placement='bottom'][data-align='end'] .tip {
    right: -2px;
  }

  /* Two pixels of overlap, so the pointer joins the bubble's border. */
  .tip-wrap[data-placement='top'] .tip-arrow {
    bottom: 100%;
    left: 50%;
    margin: 0 0 calc(var(--tip-gap) - 8px) -8px;
  }

  .tip-wrap[data-placement='bottom'] .tip-arrow {
    top: 100%;
    left: 50%;
    margin: calc(var(--tip-gap) - 8px) 0 0 -8px;
    rotate: 180deg;
  }

  .tip-wrap[data-placement='left'] .tip {
    right: 100%;
    top: 50%;
    translate: 0 -50%;
    margin-right: var(--tip-gap);
  }

  .tip-wrap[data-placement='right'] .tip {
    left: 100%;
    top: 50%;
    translate: 0 -50%;
    margin-left: var(--tip-gap);
  }

  .tip-wrap[data-placement='left'] .tip-arrow {
    right: 100%;
    top: 50%;
    margin: -5px calc(var(--tip-gap) - 12px) 0 0;
    rotate: -90deg;
  }

  .tip-wrap[data-placement='right'] .tip-arrow {
    left: 100%;
    top: 50%;
    margin: -5px 0 0 calc(var(--tip-gap) - 12px);
    rotate: 90deg;
  }
</style>
