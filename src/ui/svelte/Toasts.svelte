<script lang="ts">
  import Icon from './Icon.svelte';
  import { MARK, TONE, toastState } from './toastsState.svelte.ts';

  const state = toastState();
</script>

<div
  class="pointer-events-none absolute bottom-16 left-[30px] z-20 flex flex-col items-start gap-2"
>
  {#each state.items as toast (toast.id)}
    <div
      class="toast-in flex max-w-[min(34rem,calc(100vw-4rem))] items-center gap-2 rounded-2xl border-2 px-3.5 py-2 text-sm font-bold shadow-[0_3px_0_rgba(217,196,141,0.9)] {TONE[
        toast.kind
      ]}"
      data-testid="toast"
    >
      <span class="pill flex h-6 w-6 items-center justify-center">
        <Icon name={MARK[toast.kind]} />
      </span>
      <span>{toast.text}</span>
    </div>
  {/each}
</div>
