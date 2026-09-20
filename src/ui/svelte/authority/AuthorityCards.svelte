<script lang="ts">
  import { t } from '../../../i18n/index.ts';
  import { formatDate, formatRp } from '../../format.ts';

  import type { AuthorityCards } from './authorityCardsState.svelte.ts';

  interface Props {
    cards: AuthorityCards;
  }

  const { cards }: Props = $props();
  const state = $derived(cards.state);

  const until = $derived(
    state.view?.until !== null && state.view?.until !== undefined
      ? formatDate(state.view.until)
      : t('authorityCards.furtherNotice'),
  );
</script>

{#if state.view}
  {@const v = state.view}
  <div class="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(74,51,32,0.5)] p-4">
    <div
      class={`w-full max-w-lg p-6 ${v.kind === 'ban' ? 'card-dark' : 'card'}`}
      data-testid={`card-${v.kind}`}
    >
      {#if v.kind === 'letter'}
        <div class="label mb-1 text-[#b85e12]">
          {t('authorityCards.letterFrom', { date: formatDate(v.tick) })}
        </div>
        <div class="mb-3 text-xl font-extrabold">{t('authorityCards.letterTitle')}</div>
        <p class="mb-3 text-sm leading-relaxed">{t('authorityCards.letterBody')}</p>
        <p class="muted mb-5 text-xs">{t('authorityCards.letterNote')}</p>
        <button
          class="btn btn-orange btn-lg w-full"
          data-testid="card-dismiss"
          onclick={() => cards.handlers.dismiss()}
        >
          {t('authorityCards.letterDismiss')}
        </button>
      {:else if v.kind === 'investigation'}
        <div class="label mb-1 text-[#c94a30]">
          {t('authorityCards.investigationFrom', { date: formatDate(v.tick) })}
        </div>
        <div class="mb-3 text-xl font-extrabold">
          {v.headline?.title ?? t('authorityCards.investigationTitle')}
        </div>
        <p class="mb-3 text-sm leading-relaxed">{v.headline?.body ?? ''}</p>
        <ul class="mb-4 space-y-1 text-sm">
          <li>🚫 {t('authorityCards.noClearingUntil')} <strong>{until}</strong>.</li>
          <li>✅ {t('authorityCards.harvestsContinue')}</li>
          <li>⚠️ {t('authorityCards.secondFire')}</li>
        </ul>
        <div class="flex flex-col gap-2">
          {#if v.settleRejection === null && v.settleCost !== null}
            <button
              class="btn btn-ghost w-full flex-col items-start gap-0 text-left"
              data-testid="card-settle"
              onclick={() => cards.handlers.settle()}
            >
              <span class="flex justify-between gap-2">
                <span>{t('authorityCards.settle')}</span>
                <span class="tabular-nums opacity-80">{formatRp(v.settleCost)}</span>
              </span>
              <span class="muted block text-xs">{t('authorityCards.settleNote')}</span>
            </button>
          {:else if v.settleRejection}
            <div
              class="rounded bg-white/5 px-3 py-2 text-xs opacity-70"
              data-testid="card-settle-unavailable"
            >
              {v.settleRejection.reason}
            </div>
          {/if}
          <button
            class="btn btn-red btn-lg w-full"
            data-testid="card-dismiss"
            onclick={() => cards.handlers.dismiss()}
          >
            {t('authorityCards.acceptInvestigation')}
          </button>
        </div>
      {:else}
        <div class="label mb-1 text-[#c94a30]">
          {t('authorityCards.banFrom', { date: formatDate(v.tick) })}
        </div>
        <div class="mb-3 text-xl font-extrabold">
          {v.headline?.title ?? t('authorityCards.banTitle')}
        </div>
        <p class="mb-3 text-sm leading-relaxed">{v.headline?.body ?? ''}</p>
        <ul class="mb-4 space-y-1 text-sm">
          <li>🚫 {t('authorityCards.banNoWorkUntil')} <strong>{until}</strong>.</li>
          <li>🌱 {t('authorityCards.banForestOk')}</li>
          <li>💸 {t('authorityCards.banUpkeep')}</li>
        </ul>
        <button
          class="btn btn-red btn-lg w-full"
          data-testid="card-dismiss"
          onclick={() => cards.handlers.dismiss()}
        >
          {t('authorityCards.banDismiss')}
        </button>
      {/if}
    </div>
  </div>
{/if}
