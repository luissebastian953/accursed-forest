<script lang="ts">
  import { t } from '../../../i18n/index.ts';
  import Icon from '../base/Icon.svelte';

  import type { DisclaimerModal } from './disclaimerState.svelte.ts';

  interface Props {
    modal: DisclaimerModal;
  }

  const { modal }: Props = $props();
  const open = $derived(modal.ui.open);

  const points = $derived([
    { title: t('disclaimer.point1Title'), body: t('disclaimer.point1') },
    { title: t('disclaimer.point2Title'), body: t('disclaimer.point2') },
    { title: t('disclaimer.point3Title'), body: t('disclaimer.point3') },
  ]);
</script>

{#if open}
  <div
    class="absolute inset-0 z-[70] flex items-center justify-center bg-[rgba(74,51,32,0.62)] p-4"
  >
    <div
      class="card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden p-0"
      data-testid="disclaimer-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div class="disclaimer-head flex items-center gap-3 px-6 py-4">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.55)]"
        >
          <Icon name="police-warning" class="h-7 w-7" />
        </span>
        <div class="min-w-0">
          <div class="label text-[#8a5a06]">{t('disclaimer.badge')}</div>
          <div id="disclaimer-title" class="text-xl font-extrabold leading-tight">
            {t('disclaimer.title')}
          </div>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <p class="mb-4 text-sm leading-relaxed">{t('disclaimer.lead')}</p>
        <ul class="space-y-3">
          {#each points as point (point.title)}
            <li class="pill-muted p-3">
              <div class="mb-0.5 text-sm font-extrabold">{point.title}</div>
              <p class="muted text-xs leading-relaxed">{point.body}</p>
            </li>
          {/each}
        </ul>
      </div>

      <div class="border-t-2 border-[#f2e0b0] px-6 py-4">
        <button
          class="btn btn-orange btn-lg w-full"
          data-testid="disclaimer-accept"
          onclick={() => modal.accept()}
        >
          {t('disclaimer.accept')}
        </button>
      </div>
    </div>
  </div>
{/if}
