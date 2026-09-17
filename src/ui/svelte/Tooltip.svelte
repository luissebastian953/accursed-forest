<!--
  A hover bubble for anything the UI needs to explain in a few words: why a
  button is locked, what a number means, what a pin is for.

  It wraps its children rather than being placed by hand, so the bubble
  follows whatever it labels. CSS does the showing, not state, which is the
  one way it also works over a `disabled` button: a disabled control fires no
  events, but the pointer still lands on it and `:hover` still reaches this
  wrapper.

  Usage:
    <Tooltip text={t('hud.speedLocked')}>
      <button disabled>50x</button>
    </Tooltip>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** The words in the bubble. An empty string turns the tooltip off. */
    text: string;
    /** Which side of the child it sits on. */
    placement?: 'top' | 'bottom' | 'left' | 'right';
    /** Extra classes for the wrapper, e.g. `w-full` inside a stretched row. */
    class?: string;
    children: Snippet;
  }

  const { text, placement = 'top', class: extraClass = '', children }: Props = $props();
</script>

<span class="tip-wrap {extraClass}" data-placement={placement} data-testid="tooltip-wrap">
  {@render children()}
  {#if text}
    <!-- Not focusable, and hidden from the pointer: it must never eat a click. -->
    <span class="tip pill" role="tooltip" data-testid="tooltip">{text}</span>
  {/if}
</span>

<style>
  .tip-wrap {
    position: relative;
    display: inline-flex;
  }

  .tip {
    position: absolute;
    z-index: 30;
    max-width: 15rem;
    width: max-content;
    pointer-events: none;
    opacity: 0;
    background: var(--ink);
    color: var(--card);
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.25;
    text-align: center;
    padding: 0.3rem 0.55rem;
    box-shadow: 0 3px 0 rgba(0, 0, 0, 0.18);
    transition:
      opacity 120ms ease,
      transform 120ms ease;
  }

  .tip-wrap[data-placement='top'] .tip {
    bottom: 100%;
    left: 50%;
    transform: translate(-50%, 2px);
    margin-bottom: 0.4rem;
  }

  .tip-wrap[data-placement='bottom'] .tip {
    top: 100%;
    left: 50%;
    transform: translate(-50%, -2px);
    margin-top: 0.4rem;
  }

  .tip-wrap[data-placement='left'] .tip {
    right: 100%;
    top: 50%;
    transform: translate(2px, -50%);
    margin-right: 0.4rem;
  }

  .tip-wrap[data-placement='right'] .tip {
    left: 100%;
    top: 50%;
    transform: translate(-2px, -50%);
    margin-left: 0.4rem;
  }

  .tip-wrap:hover .tip,
  .tip-wrap:focus-within .tip {
    opacity: 1;
  }

  .tip-wrap[data-placement='top']:hover .tip,
  .tip-wrap[data-placement='top']:focus-within .tip,
  .tip-wrap[data-placement='bottom']:hover .tip,
  .tip-wrap[data-placement='bottom']:focus-within .tip {
    transform: translate(-50%, 0);
  }

  .tip-wrap[data-placement='left']:hover .tip,
  .tip-wrap[data-placement='left']:focus-within .tip,
  .tip-wrap[data-placement='right']:hover .tip,
  .tip-wrap[data-placement='right']:focus-within .tip {
    transform: translate(0, -50%);
  }

  @media (prefers-reduced-motion: reduce) {
    .tip {
      transition: none;
    }
  }
</style>
