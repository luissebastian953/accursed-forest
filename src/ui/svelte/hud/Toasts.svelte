<script lang="ts">
  import { t } from '../../../i18n/index.ts';

  import { TONE, dismissToast, toastState } from './toastsState.svelte.ts';

  const state = toastState();
</script>

<div
  class="pointer-events-none absolute bottom-16 left-[30px] z-20 flex flex-col items-start gap-2"
>
  {#each state.items as toast (toast.id)}
    <div
      class="toast-in pointer-events-auto flex max-w-[min(34rem,calc(100vw-4rem))] items-center gap-2.5 rounded-2xl border-2 py-2 pl-2 pr-4 text-sm font-bold shadow-[0_3px_0_rgba(217,196,141,0.9)] {TONE[
        toast.kind
      ]}"
      data-testid="toast"
    >
      <!--
        The dismiss sits where the mark used to: one round control on the left,
        rather than a decorative icon at one end and a button at the other.
      -->
      <button
        class="btn btn-close pointer-events-auto !h-6 !w-6 shrink-0 !text-xs"
        aria-label={t('toasts.close')}
        data-testid="toast-close"
        onclick={() => dismissToast(toast.id)}
      >
        ✕
      </button>
      <span
        >{toast.text}{#if toast.repeat > 1}<span class="num opacity-70">&nbsp;x{toast.repeat}</span
          >{/if}</span
      >
    </div>
  {/each}
</div>
