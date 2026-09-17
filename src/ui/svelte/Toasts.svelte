<script lang="ts">
  import { t } from '../../i18n/index.ts';

  import Icon from './Icon.svelte';
  import { MARK, TONE, dismissToast, toastState } from './toastsState.svelte.ts';

  const state = toastState();
</script>

<div
  class="pointer-events-none absolute bottom-16 left-[30px] z-20 flex flex-col items-start gap-2"
>
  {#each state.items as toast (toast.id)}
    <div
      class="toast-in pointer-events-auto flex max-w-[min(34rem,calc(100vw-4rem))] items-center gap-2 rounded-2xl border-2 py-2 pl-3.5 pr-2 text-sm font-bold shadow-[0_3px_0_rgba(217,196,141,0.9)] {TONE[
        toast.kind
      ]}"
      data-testid="toast"
    >
      <span class="pill flex h-6 w-6 items-center justify-center">
        <Icon name={MARK[toast.kind]} />
      </span>
      <span>{toast.text}</span>
      <button
        class="btn btn-close pointer-events-auto ml-1 !h-6 !w-6 shrink-0 !text-xs"
        aria-label={t('toasts.close')}
        data-testid="toast-close"
        onclick={() => dismissToast(toast.id)}
      >
        ✕
      </button>
    </div>
  {/each}
</div>
