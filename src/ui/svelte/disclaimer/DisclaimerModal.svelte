<script lang="ts">
  import { t } from '../../../i18n/index.ts';
  import type { IconName } from '../../icons.ts';
  import Icon from '../base/Icon.svelte';

  import type { DisclaimerModal } from './disclaimerState.svelte.ts';

  interface Props {
    modal: DisclaimerModal;
  }

  const { modal }: Props = $props();
  const open = $derived(modal.ui.open);
  const hushed = $derived(modal.ui.hushed);

  interface Point {
    icon: IconName;
    title: string;
    body: string;
    grave: boolean;
  }

  const points = $derived<Point[]>([
    {
      icon: 'news',
      title: t('disclaimer.point1Title'),
      body: t('disclaimer.point1'),
      grave: false,
    },
    {
      icon: 'coin',
      title: t('disclaimer.point2Title'),
      body: t('disclaimer.point2'),
      grave: false,
    },
    { icon: 'fire', title: t('disclaimer.point3Title'), body: t('disclaimer.point3'), grave: true },
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
      <div class="disclaimer-head flex items-center gap-4 px-6 py-5">
        <span class="disclaimer-crest">
          <Icon name="police-warning" class="h-8 w-8" />
        </span>
        <div class="min-w-0">
          <div class="label text-[#8a5a06]">{t('disclaimer.badge')}</div>
          <div id="disclaimer-title" class="text-2xl font-extrabold leading-tight">
            {t('disclaimer.title')}
          </div>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <p class="mb-4 font-bold leading-relaxed">{t('disclaimer.lead')}</p>
        <ul class="space-y-2.5">
          {#each points as point (point.title)}
            <li class="disclaimer-point" data-grave={point.grave || undefined}>
              <span class="disclaimer-badge">
                <Icon name={point.icon} class="h-5 w-5" />
              </span>
              <p class="muted text-sm leading-relaxed">
                <strong class="disclaimer-point-title">{point.title}</strong>
                {point.body}
              </p>
            </li>
          {/each}
        </ul>
      </div>

      <div class="flex flex-wrap items-center gap-3 border-t-2 border-[#f2e0b0] px-6 py-4">
        <label class="flex flex-1 cursor-pointer items-center gap-2.5 text-sm font-bold">
          <input
            class="tick"
            type="checkbox"
            checked={hushed}
            data-testid="disclaimer-hush"
            onchange={(event) => modal.hush(event.currentTarget.checked)}
          />
          {t('disclaimer.dontShow')}
        </label>
        <button
          class="btn btn-green btn-lg"
          data-testid="disclaimer-accept"
          onclick={() => modal.accept()}
        >
          {t('disclaimer.accept')}
        </button>
      </div>
    </div>
  </div>
{/if}
