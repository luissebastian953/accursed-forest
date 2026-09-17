<script lang="ts">
  import { t } from '../../i18n/index.ts';

  import { controlsHelpState, type ControlsHelpHandlers } from './controlsHelpState.svelte.ts';

  interface Props {
    handlers: ControlsHelpHandlers;
  }

  const { handlers }: Props = $props();
  const state = controlsHelpState();

  const mouse = $derived([
    ['Click', t('controlsHelp.mouseClickDesc')],
    ['Double-click', t('controlsHelp.mouseDoubleClickDesc')],
    ['Drag', t('controlsHelp.mouseDragDesc')],
    ['Scroll', t('controlsHelp.mouseScrollDesc')],
  ]);

  const keys = $derived([
    ['Space', t('controlsHelp.keySpaceDesc')],
    ['1  2  3', t('controlsHelp.keySpeedDesc')],
    ['Q  E', t('controlsHelp.keyTurnDesc')],
    ['F', t('controlsHelp.keyKopdesJumpDesc')],
    ['K', t('controlsHelp.keyShopDesc')],
    ['N', t('controlsHelp.keyNewsDesc')],
    ['H', t('controlsHelp.keyHelpDesc')],
    ['Esc', t('controlsHelp.keyEscDesc')],
  ]);
</script>

{#if state.open}
  <div
    class="card absolute left-3 z-30 w-[min(20rem,calc(100%-1.5rem))] p-4 text-sm"
    data-testid="controls-help"
    style="top: var(--panel-top, 7rem)"
  >
    <div class="mb-2 flex items-center justify-between">
      <div class="text-base font-extrabold">{t('controlsHelp.title')}</div>
      <button
        class="btn btn-close"
        data-testid="controls-help-close"
        onclick={() => handlers.close()}
      >
        ✕
      </button>
    </div>
    <div class="label mb-1">{t('controlsHelp.mouse')}</div>
    <ul class="mb-3 space-y-1">
      {#each mouse as [key, what] (key)}
        <li class="flex items-baseline gap-3">
          <kbd
            class="pill-muted min-w-[5.5rem] shrink-0 px-1.5 py-0.5 text-center font-mono text-xs"
            >{key}</kbd
          >
          <span class="font-bold">{what}</span>
        </li>
      {/each}
    </ul>
    <div class="label mb-1">{t('controlsHelp.keyboard')}</div>
    <ul class="mb-3 space-y-1">
      {#each keys as [key, what] (key)}
        <li class="flex items-baseline gap-3">
          <kbd
            class="pill-muted min-w-[5.5rem] shrink-0 px-1.5 py-0.5 text-center font-mono text-xs"
            >{key}</kbd
          >
          <span class="font-bold">{what}</span>
        </li>
      {/each}
    </ul>
    <p class="muted text-xs leading-relaxed">{t('controlsHelp.tip')}</p>
  </div>
{/if}
