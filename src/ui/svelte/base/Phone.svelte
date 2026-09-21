<script lang="ts">
  import type { Snippet } from 'svelte';

  import { formatDateShort } from '../../format.ts';

  interface Props {
    testId: string;
    /** The sim tick, for the status bar's date. */
    tick: number;
    header: Snippet;
    children: Snippet;
    footer?: Snippet;
  }

  const { testId, tick, header, children, footer }: Props = $props();

  const FRAME_URL = `${import.meta.env.BASE_URL}ui/phone-frame.svg`;
  const FRAME_TOP_URL = `${import.meta.env.BASE_URL}ui/phone-frame-top.svg`;

  /**
   * The frame hangs from the bar's own bottom edge and fills the height below
   * it; the screen zooms with the frame's width, 0.7 to 1.35 of a 360px layout.
   */
  const REFERENCE_WIDTH = 360;
  let frame = $state<HTMLElement | null>(null);
  let scale = $state(1);
  $effect(() => {
    if (!frame) return;

    const fit = (width: number) => Math.min(1.35, Math.max(0.7, width / REFERENCE_WIDTH));

    // Size once now: the observer's first call waits for a frame, and the
    // software renderer can hold that frame for a second.
    scale = fit(frame.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => {
      scale = fit(entry?.contentRect.width ?? REFERENCE_WIDTH);
    });

    observer.observe(frame);
    return () => observer.disconnect();
  });
</script>

<!-- `data-phone` marks the whole frame: a handset's own screen does not click
     back at you, so the UI press sound stops at this boundary. -->
<div
  class="@container absolute bottom-6 left-3 z-20 aspect-[480/920] max-h-[1400px] min-h-[620px] max-w-[calc(100vw-1.5rem)]"
  style="top: var(--panel-top, 12.5rem)"
  data-testid={testId}
  data-phone="true"
  bind:this={frame}
>
  <img class="absolute inset-0 h-full w-full select-none" src={FRAME_URL} alt="" />

  <div
    class="absolute bottom-[4.35%] left-[8.33%] right-[8.33%] top-[4.35%] flex flex-col overflow-hidden rounded-[8.75cqw] text-sm"
    style="zoom: {scale}"
  >
    <div
      class="flex items-center justify-between px-[6%] pb-1 pt-[2.2%] text-[0.7rem] font-extrabold text-[#8f7a52]"
    >
      <span class="num">{formatDateShort(tick)}</span>
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

    {@render header()}

    <div class="min-h-0 flex-1 overflow-y-auto px-[6%] py-3">{@render children()}</div>

    {#if footer}
      <div class="px-[6%] pb-[6%] pt-2">{@render footer()}</div>
    {:else}
      <div class="pb-[5%]"></div>
    {/if}
  </div>

  <img
    class="pointer-events-none absolute inset-0 h-full w-full select-none"
    src={FRAME_TOP_URL}
    alt=""
  />
</div>
