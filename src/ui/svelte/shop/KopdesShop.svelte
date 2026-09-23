<script lang="ts">
  import { WORKERS_FROM_LEVEL } from '@sim/balance/mobs';

  import { t } from '../../../i18n/index.ts';
  import { formatDate, formatKg, formatRp, formatRpCompact } from '../../format.ts';
  import Icon from '../base/Icon.svelte';
  import Phone from '../base/Phone.svelte';
  import PhoneHeader from '../base/PhoneHeader.svelte';
  import Tooltip from '../base/Tooltip.svelte';
  import AutoHarvestToggle from '../block/AutoHarvestToggle.svelte';

  import { shopView, type KopdesShop, type ShopTab } from './kopdesShopState.svelte.ts';

  interface Props {
    shop: KopdesShop;
  }

  const { shop }: Props = $props();
  const ui = $derived(shop.ui);

  const view = $derived.by(() => {
    void shop.ui.version;
    return shop.sim ? shopView(shop.sim) : null;
  });

  const TABS: ShopTab[] = ['buy', 'sell'];
</script>

{#if view}
  {@const v = view}
  <Phone testId="kopdes-shop" tick={v.tick}>
    {#snippet header()}
      <PhoneHeader
        tile="kopdes"
        title={v.kopdes ? t('shop.title') : t('shop.noKopdes')}
        closeTestId="shop-close"
        onClose={() => shop.handlers.close()}
      >
        {#snippet subtitle()}
          <div class="label">
            {v.kopdes
              ? t('shop.subtitle', { level: v.kopdes.level, range: v.kopdes.range })
              : t('shop.subtitleNone')}
          </div>
        {/snippet}
      </PhoneHeader>
      {#if v.kopdes}
        <div class="border-b-2 border-[var(--card-edge)] px-[6%] pb-3">
          <div class="pill-muted flex gap-1 p-1 text-xs">
            {#each TABS as tab (tab)}
              <button
                class="btn btn-sm flex-1 uppercase {ui.tab === tab
                  ? tab === 'buy'
                    ? 'btn-coral'
                    : 'btn-green'
                  : 'btn-ghost'}"
                data-testid={`shop-tab-${tab}`}
                onclick={() => (ui.tab = tab)}
              >
                {tab === 'buy' ? t('shop.tabBuy') : t('shop.tabSell')}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/snippet}

    {#if !v.kopdes}
      <div class="muted text-xs">{t('shop.placeHint')}</div>
    {:else if ui.tab === 'buy'}
      <div class="flex flex-col gap-3">
        {#if v.indexPct !== 100}
          <div class="pill-muted text-xs font-bold text-[#b85e12]">
            {t('shop.priceIndex', { pct: v.indexPct })}
          </div>
        {/if}
        {#each v.rows as row (row.item)}
          <div class="pill-muted p-2.5">
            <div class="flex items-center gap-2">
              <span class="pill flex h-9 w-9 shrink-0 items-center justify-center">
                <Icon name={row.icon} />
              </span>
              <!-- The name holds the line alone: sharing it with the price left
                   sixty pixels, and a name with nowhere to break ran over it. -->
              <div class="min-w-0 flex-1">
                <div class="font-extrabold">{t(`shop.item_${row.item}`)}</div>
                <div class="flex items-baseline justify-between gap-2 text-xs">
                  <span class="num">{t('shop.each', { price: formatRp(row.unit) })}</span>
                  <span class="muted shrink-0">
                    {t('shop.inStock')}
                    <span data-testid={`stock-${row.item}`}>{row.stock}</span>
                  </span>
                </div>
              </div>
            </div>
            <div class="muted mt-1 text-xs">{t(`shop.note_${row.item}`)}</div>
            <div class="mt-2 flex gap-1.5">
              {#each row.bundles as bundle (bundle.quantity)}
                <button
                  class="btn btn-sm btn-green flex-1 flex-col gap-0"
                  disabled={bundle.rejection !== null}
                  title={bundle.rejection ?? ''}
                  data-testid={`buy-${row.item}-${bundle.quantity}`}
                  onclick={() => shop.act(bundle.command)}
                >
                  <span>{t('shop.buy', { quantity: bundle.quantity })}</span>
                  <span class="num text-[0.68rem] opacity-90">{formatRp(bundle.total)}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        <div data-testid="shop-workers">
          <div class="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
            <div class="font-extrabold">{t('shop.workers')}</div>
            <div class="muted text-xs">{t('shop.workersNote')}</div>
          </div>
          <div class="flex flex-col gap-1.5">
            {#each v.workers as worker (worker.kind)}
              <!-- One pill each: side by side these wrapped three deep on the phone. -->
              <div class="pill-muted p-2.5">
                <div class="flex items-center gap-2">
                  <span class="pill flex h-8 w-8 shrink-0 items-center justify-center">
                    <Icon name={worker.icon} />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-extrabold">{t(`shop.worker_${worker.kind}`)}</div>
                    <div class="num muted text-xs">
                      {t('shop.perDay', { wage: formatRp(worker.wagePerDay) })}
                    </div>
                  </div>
                </div>
                <div class="muted mt-1 text-xs">{t(`shop.blurb_${worker.kind}`)}</div>
                <Tooltip
                  text={worker.locked
                    ? t('shop.workersLocked', { level: WORKERS_FROM_LEVEL })
                    : (worker.rejection ?? '')}
                  class="mt-2 w-full"
                >
                  <button
                    class="btn btn-sm w-full {worker.hired ? 'btn-coral' : 'btn-green'}"
                    disabled={worker.rejection !== null}
                    data-testid={`worker-${worker.kind}`}
                    data-locked={worker.locked ? 'kopdes' : undefined}
                    onclick={() => shop.act(worker.command)}
                  >
                    {#if worker.locked}<Icon name="lock" />{/if}{worker.hired
                      ? t('shop.dismiss')
                      : t('shop.hire', { fee: formatRp(worker.hireFee) })}
                  </button>
                </Tooltip>
              </div>
            {/each}
          </div>
        </div>

        <div class="pill-muted p-2.5">
          <div class="flex items-baseline justify-between gap-2">
            <div class="shrink-0 font-extrabold">{t('shop.picking')}</div>
            <div class="muted text-right text-xs">
              {v.kopdes.autoHarvest ? t('shop.pickingCrew') : t('shop.pickingYou')}
            </div>
          </div>
          <AutoHarvestToggle on={v.autoHarvest.on} toggle={() => shop.act(v.autoHarvest.command)} />
        </div>

        <div class="pill-muted p-2.5">
          <div class="flex items-baseline justify-between gap-2">
            <div class="font-extrabold">{t('shop.tbsToday')}</div>
            <div class="num shrink-0" data-testid="shop-price">
              {t('shop.perKg', { price: formatRp(v.price) })}
              {#if v.trend === 'flat'}
                <span class="muted">=</span>
              {:else}
                <Icon name={v.trend === 'up' ? 'triangle-up' : 'triangle-down'} class="!h-4 !w-4" />
              {/if}
            </div>
          </div>
          <div class="muted mt-1 text-xs">
            {t('shop.sellNote', { kg: formatKg(v.soldKgTotal) })}
          </div>
        </div>

        <div class="pill-muted p-2.5">
          <div class="mb-1 font-extrabold">{t('shop.recentSales')}</div>
          {#if v.sales.length === 0}
            <div class="muted text-xs">{t('shop.noSales')}</div>
          {:else}
            <ul class="text-xs">
              {#each v.sales as sale, i (i)}
                <li class="flex justify-between gap-2 py-0.5">
                  <span class="muted">{formatDate(sale.tick)}</span>
                  <span class="muted">{sale.note}</span>
                  <span class="num">{formatRpCompact(sale.amount)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div class="pill-muted p-2.5">
          <div class="flex items-baseline justify-between gap-2">
            <div class="font-extrabold">{t('shop.upgradeKopdes')}</div>
            <div class="muted text-right text-xs">
              {v.upgrade.cost === null
                ? t('shop.maxLevel')
                : t('shop.upgradeNext', {
                    from: v.upgrade.from,
                    to: v.upgrade.to,
                    range: v.upgrade.range,
                  })}
            </div>
          </div>
          <button
            class={v.upgrade.rejection
              ? 'mt-2 w-full cursor-not-allowed rounded bg-white/10 px-3 py-1.5 text-left opacity-60'
              : 'mt-2 w-full rounded bg-emerald-600 px-3 py-1.5 text-left font-medium hover:bg-emerald-500'}
            disabled={v.upgrade.rejection !== null}
            data-testid="shop-upgrade"
            onclick={() => shop.act(v.upgrade.command)}
          >
            <span class="flex w-full items-center justify-between gap-2">
              <span>{t('shop.upgrade')}</span>
              {#if v.upgrade.cost !== null}
                <span class="num rounded-lg bg-black/15 px-1.5 py-0.5 text-xs"
                  >{formatRp(v.upgrade.cost)}</span
                >
              {/if}
            </span>
          </button>
          {#if v.upgrade.rejection}
            <div class="mt-0.5 px-1 text-xs font-bold text-[#b85e12]">{v.upgrade.rejection}</div>
          {/if}
        </div>
      </div>
    {/if}
  </Phone>
{/if}
