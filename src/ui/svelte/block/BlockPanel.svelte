<script lang="ts">
  import { t } from '../../../i18n/index.ts';
  import { formatKg, formatRp } from '../../format.ts';
  import Icon from '../base/Icon.svelte';

  import AutoHarvestToggle from './AutoHarvestToggle.svelte';
  import { blockView, type ActionView, type BlockPanel } from './blockPanelState.svelte.ts';

  interface Props {
    panel: BlockPanel;
  }

  const { panel }: Props = $props();
  const ui = $derived(panel.ui);

  const view = $derived.by(() => {
    void ui.version;
    return panel.sim && ui.block !== null ? blockView(panel.sim, ui.block, ui.slot) : null;
  });
</script>

{#snippet actionButton(action: ActionView)}
  <div>
    <button
      class={action.minor ? 'btn btn-sm btn-ghost' : 'btn btn-lg w-full btn-green'}
      disabled={action.rejection !== null}
      title={action.rejection ?? ''}
      data-testid={action.testId}
      onclick={() => panel.act(action.command)}
    >
      <span class="flex w-full items-center justify-between gap-2">
        <span class="flex items-center gap-2">
          {#if action.icon}<Icon name={action.icon} />{/if}{action.label}
        </span>
        {#if action.badge !== undefined}
          <span class="num rounded-lg bg-black/15 px-1.5 py-0.5 text-xs">{action.badge}</span>
        {:else if action.cost !== undefined}
          <span class="num rounded-lg bg-black/15 px-1.5 py-0.5 text-xs"
            >{formatRp(action.cost)}</span
          >
        {/if}
      </span>
    </button>
    {#if action.rejection && !action.minor}
      <div class="mt-0.5 px-1 text-xs font-bold text-[#b85e12]">{action.rejection}</div>
    {/if}
  </div>
{/snippet}

<div class="flex h-full min-h-0 flex-col text-[0.95rem]">
  {#if !view}
    <div class="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <span class="pill flex h-14 w-14 items-center justify-center">
        <Icon name="biome-grassfield" class="icon-lg" />
      </span>
      <div class="text-lg font-extrabold">{t('block.nothingSelected')}</div>
      <p class="muted text-sm leading-snug">{t('block.clickHint')}</p>
    </div>
  {:else}
    {@const v = view}
    <div class="flex h-full flex-col" data-testid="block-panel">
      <header
        class="flex items-start justify-between gap-2 border-b-2 border-dashed border-[#f2e0b0] p-4"
      >
        <div class="flex items-center gap-3">
          <span class="pill flex h-12 w-12 items-center justify-center">
            <Icon name={v.icon} class="icon-lg" />
          </span>
          <div>
            <div class="label">{t('block.block', { x: v.x, y: v.y })}</div>
            <div class="text-xl font-extrabold leading-tight">{v.title}</div>
            <div class="label" data-testid="block-phase">{v.phase}</div>
          </div>
        </div>
        <button
          class="btn btn-close"
          aria-label={t('block.close')}
          onclick={() => panel.handlers.close()}
        >
          ✕
        </button>
      </header>

      <!--
        While a crew has the block there is nothing to decide, so the panel
        reports and takes no presses. The close button stays live.
      -->
      <div
        class="flex min-h-0 flex-1 flex-col {v.busy ? 'opacity-55 saturate-50' : ''}"
        inert={v.busy}
      >
        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div class="grid grid-cols-2 gap-2">
            {#each v.tiles as tile (tile.label)}
              <div class="pill">
                <div class="label">{tile.label}</div>
                <div class="font-extrabold">
                  {#if tile.gauge !== undefined}
                    <span class="flex items-center gap-2">
                      <span class="gauge w-16">
                        <i style="width: {tile.gauge}%; --gauge-from: #7ba4ff; --gauge-to: #5a8bff"
                        ></i>
                      </span>
                      <span class="num">{tile.value}</span>
                    </span>
                  {:else if tile.testId}
                    <span data-testid={tile.testId}>{tile.value}</span>
                  {:else}
                    {tile.value}
                  {/if}
                </div>
                {#if tile.note}<div class="muted text-xs">{tile.note}</div>{/if}
              </div>
            {/each}
          </div>

          {#if v.kopdes}
            <div class="pill mb-3 text-xs">
              <div class="flex items-baseline justify-between">
                <span class="font-extrabold">{t('block.level', { n: v.kopdes.level })}</span>
                <span class="muted">{t('block.sellsWithin', { n: v.kopdes.range })}</span>
              </div>
              <button
                class="btn btn-ghost mt-2 w-full justify-between"
                data-testid="action-OpenShop"
                onclick={() => panel.handlers.openShop()}
              >
                {t('block.openShop')}
              </button>
              {#if v.autoHarvest}
                {@const auto = v.autoHarvest}
                <AutoHarvestToggle on={auto.on} toggle={() => panel.act(auto.command)} />
              {/if}
              {#if v.settle}
                {@const settle = v.settle}
                <!--
                The envelope. It only appears with a case or a suspension
                standing, and says what it is for under the price.
              -->
                <button
                  class="btn btn-ghost mt-2 w-full justify-between !border-[#e0b7a8] !bg-[#fdeae6]"
                  disabled={!settle.enabled}
                  data-testid="action-SettleInvestigation"
                  title={settle.note}
                  onclick={() => panel.act({ type: 'SettleInvestigation' })}
                >
                  <span class="flex items-center gap-2">
                    <Icon name="police-warning" />
                    {t('block.settle')}
                  </span>
                  <span class="num">{formatRp(settle.cost)}</span>
                </button>
                <div class="muted mt-1 text-xs leading-snug">{settle.note}</div>
              {/if}
            </div>
          {/if}

          {#if v.palms}
            <div class="rounded-2xl border-2 border-[#bfe3a8] bg-[#eaf7dd] p-3 text-xs">
              <div class="mb-1 flex items-center justify-between gap-2">
                <div class="text-base font-extrabold">
                  {v.palms.heading}: <span class="num">{v.palms.count}</span>
                </div>
                <span class="chip chip-cream">{v.palms.stages}</span>
              </div>
              {#if v.palms.growth}
                <div class="muted num mt-1" data-testid="growth-progress">{v.palms.growth}</div>
              {/if}
              {#if v.palms.bearing}
                <div
                  class="mt-1.5 flex items-center justify-between text-sm font-extrabold"
                  data-testid="harvest-info"
                >
                  <span class="flex items-center gap-1.5">
                    {t('block.onTrees')} <span class="num">{v.palms.bearing.kg}</span>
                    {#if v.palms.bearing.full}
                      <span
                        class="chip chip-pest !px-2 !py-0.5 !text-[0.68rem]"
                        title={t('block.onTreesFullNote')}
                      >
                        {t('block.onTreesFull')}
                      </span>
                    {/if}
                  </span>
                  <span class={v.palms.bearing.ripe ? 'text-[#c94a30]' : 'muted'}
                    >{v.palms.bearing.note}</span
                  >
                </div>
              {/if}
            </div>
          {/if}

          {#if v.pests}
            {@const p = v.pests}
            <div
              class="mb-3 rounded-2xl border-2 border-[#ffc9bd] bg-[#ffece7] p-2.5 text-xs"
              data-testid="pest-section"
            >
              <div class="mb-1 flex items-baseline justify-between">
                <span class="flex items-center gap-1.5 font-extrabold"
                  ><Icon name="beetle" /> {t('block.pests')}</span
                >
                {#if p.plagued}
                  <span class="chip chip-pest" data-testid="plague-badge">{t('block.plague')}</span>
                {:else}
                  <span class="opacity-60">{p.pressure}</span>
                {/if}
              </div>
              <div class="flex flex-wrap gap-x-3">
                <span data-testid="pest-beetles">{p.beetles}</span>
                {#if p.ganoderma}<span data-testid="pest-ganoderma">{p.ganoderma}</span>{/if}
              </div>
              {#if p.windows}<div class="mt-0.5 opacity-70">{p.windows}</div>{/if}
              {#if p.breeding}<div class="mt-0.5 text-amber-200/90">{t('block.breeding')}</div>{/if}

              <!-- Three across: the six treatments sit as two even rows. -->
              <div class="mt-2 grid grid-cols-3 gap-1.5">
                {#each p.treatments as action (action.testId)}
                  {@render actionButton(action)}
                {/each}
              </div>

              {#if p.grid}
                <div class="mt-2">
                  <div class="label mb-1">{t('block.bySlot')}</div>
                  <div class="grid grid-cols-12 gap-[3px]" data-testid="slot-grid">
                    {#each p.grid.cells as cell (cell.slot)}
                      <button
                        class="flex h-4 w-4 items-center justify-center rounded-[3px] {cell.cls} {cell.sick
                          ? 'slot-alert'
                          : ''}"
                        title={cell.title}
                        aria-label={cell.title}
                        data-testid={`slot-cell-${cell.slot}`}
                        data-sick={cell.sick || undefined}
                        onclick={() => panel.toggleSlot(cell.slot)}
                      >
                        {#if cell.sick}
                          <span
                            class="text-[11px] font-black leading-none text-[#7a2a12]"
                            aria-hidden="true">!</span
                          >
                        {/if}
                      </button>
                    {/each}
                  </div>
                  {#if p.grid.detail?.kind === 'palm'}
                    {@const d = p.grid.detail}
                    <div class="pill mt-2" data-testid="slot-detail">
                      <div class="flex justify-between">
                        <span>{d.head}</span>
                        <span class="muted num">{d.health}</span>
                      </div>
                      {#each d.lines as line (line)}
                        <div
                          class={line === t('block.trenched') ? 'text-[#2f56b8]' : 'text-[#b85e12]'}
                        >
                          {line}
                        </div>
                      {/each}
                      <div class="mt-1.5 flex flex-wrap gap-1.5">
                        {#each d.actions as action (action.testId)}
                          {@render actionButton(action)}
                        {/each}
                      </div>
                    </div>
                  {:else if p.grid.detail?.kind === 'empty'}
                    <div class="pill muted mt-2" data-testid="slot-detail">
                      {p.grid.detail.text}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}

          {#if v.burn}
            {@const b = v.burn}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="rounded-2xl border-2 border-[#ffd6a1] bg-[#ffeed6] p-2.5"
              data-testid="burn-section"
              onmouseenter={() => panel.handlers.hoverBurn(b.fuel)}
              onmouseleave={() => panel.handlers.hoverBurn(null)}
            >
              <div class="mb-1.5 flex items-baseline justify-between text-xs">
                <span class="flex items-center gap-1.5 font-extrabold"
                  ><Icon name="fire" /> {t('block.burn')}</span
                >
                <span class="muted num">{b.meta}</span>
              </div>
              {#if b.wonNote}
                <div
                  class="mb-1.5 rounded-xl bg-[#ffd9bd] px-2 py-1.5 text-xs font-extrabold text-[#9e2e20]"
                  data-testid="burn-won"
                >
                  {b.wonNote}
                </div>
              {/if}
              <div class="flex gap-1.5">
                {#each b.options as option (option.intensity)}
                  <button
                    class="btn btn-sm flex-1 flex-col gap-0 {option.tips
                      ? 'btn-red'
                      : 'btn-orange'}"
                    disabled={option.rejection !== null}
                    title={option.title}
                    data-testid={`action-BurnBlock-${option.intensity}`}
                    onclick={() => panel.act(option.command)}
                  >
                    {option.label}
                    <span class="block text-[0.68rem] font-bold opacity-90">{option.sub}</span>
                  </button>
                {/each}
              </div>
              <div class="muted mt-1.5 text-xs" data-testid="burn-preview">
                {b.preview}
                {#if b.wildfire}<span class="text-[#9e2e20]"> {t('block.wildfireJoins')}</span>{/if}
              </div>
            </div>
          {/if}

          {#if v.minor.length > 0}
            <div class="flex flex-wrap gap-1.5">
              {#each v.minor as action (action.testId)}
                {@render actionButton(action)}
              {/each}
            </div>
          {/if}
        </div>

        {#if v.land}
          {@const land = v.land}
          <!-- Open land's two things to do with it (GDD 8 panel 11a): the crew, or the saplings. -->
          <footer class="flex flex-col gap-2 border-t-2 border-dashed border-[#f2e0b0] p-4">
            <div class="label">{t('block.clearThis')}</div>
            <button
              class="btn btn-green btn-lg w-full"
              disabled={land.chop.rejection !== null}
              title={land.chop.rejection ?? ''}
              data-testid={land.chop.testId}
              onclick={() => panel.act(land.chop.command)}
            >
              <span class="flex w-full items-center gap-2">
                <Icon name="axe-chop" />
                <span>{land.chop.label}</span>
                <span class="muted !text-white/75 min-w-0 flex-1 truncate text-left text-xs">
                  {land.chopNote}
                </span>
                <span class="num rounded-lg bg-black/15 px-1.5 py-0.5 text-xs">
                  {formatRp(land.chop.cost ?? 0)}
                </span>
              </span>
            </button>
            {#if land.chop.rejection}
              <div class="px-1 text-xs font-bold text-[#b85e12]">{land.chop.rejection}</div>
            {/if}

            <div class="label mt-1">{t('block.orKeepForest')}</div>
            <button
              class="btn btn-lg w-full {land.reforest.rejection === null
                ? 'btn-ghost !border-[#8fc98a] !bg-white'
                : 'btn-ghost'}"
              disabled={land.reforest.rejection !== null}
              title={land.reforest.rejection ?? ''}
              data-testid={land.reforest.testId}
              onclick={() => panel.act(land.reforest.command)}
            >
              <span class="flex w-full items-center gap-2">
                <Icon name="shop-sapling" />
                <span>{land.reforest.label}</span>
                <span class="muted min-w-0 flex-1 truncate text-left text-xs">
                  {land.reforest.detail}
                </span>
                {#if land.reforest.locked}
                  <span class="chip chip-cream flex items-center gap-1 text-xs">
                    <Icon name="lock" />{t('block.locked')}
                  </span>
                {:else}
                  <span
                    class="num rounded-lg px-1.5 py-0.5 text-xs {land.reforest.rejection === null
                      ? 'bg-[#e6f4e2] text-[#2f7a2b]'
                      : 'bg-[#ffe6e0] text-[#9e2e20]'}"
                  >
                    {formatRp(land.reforest.cost ?? 0)}
                  </span>
                {/if}
              </span>
            </button>
            <div
              class="px-1 text-xs font-bold leading-snug {land.reforest.locked ||
              land.reforest.rejection === null
                ? 'muted'
                : 'text-[#9e2e20]'}"
            >
              {land.reforest.note}
            </div>
          </footer>
        {/if}

        {#if v.major.length > 0 || (v.autoHarvest && !v.kopdes)}
          <footer class="flex flex-col gap-2 border-t-2 border-dashed border-[#f2e0b0] p-4">
            {#each v.major as action (action.testId)}
              {@render actionButton(action)}
            {/each}
            {#if v.autoHarvest && !v.kopdes}
              {@const auto = v.autoHarvest}
              <AutoHarvestToggle on={auto.on} toggle={() => panel.act(auto.command)} />
            {/if}
          </footer>
        {/if}

        {#if v.danger}
          {@const danger = v.danger}
          <!-- The danger zone (GDD 8 panel 13a): folded shut so it never competes with Harvest or Fertilize. -->
          <footer class="border-t-2 border-dashed border-[#f2e0b0] p-4" data-testid="danger-zone">
            <div class="danger rounded-2xl border-2 border-[#e9a898] bg-[#fbe4dc]">
              <button
                class="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
                aria-expanded={panel.ui.dangerOpen}
                data-testid="danger-toggle"
                onclick={() => panel.toggleDanger()}
              >
                <Icon name="police-warning" />
                <span class="text-xs font-extrabold tracking-[0.08em] text-[#b0402c] uppercase">
                  {t('block.dangerZone')}
                </span>
                <span class="min-w-0 flex-1 truncate text-xs font-bold text-[#9e4a34]">
                  {t('block.dangerZoneSub')}
                </span>
                <svg
                  class="chevron h-4 w-4 shrink-0 text-[#b0402c] {panel.ui.dangerOpen
                    ? 'open'
                    : ''}"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    stroke-width="3.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>

              {#if panel.ui.dangerOpen}
                <div
                  class="flex flex-col gap-2 border-t-2 border-dashed border-[#efbcae] px-3.5 pt-3 pb-3.5"
                >
                  {#if !panel.ui.confirmClear}
                    <div class="px-0.5 text-xs font-bold leading-snug text-[#8a4a3a]">
                      {t('block.clearPlantationNote', {
                        n: danger.palms,
                        what: danger.what,
                        days: danger.days,
                      })}
                    </div>
                    <button
                      class="btn btn-red btn-lg w-full"
                      disabled={danger.rejection !== null}
                      title={danger.rejection ?? ''}
                      data-testid="action-ClearPlantation"
                      onclick={() => panel.askClear(true)}
                    >
                      <span class="flex w-full items-center gap-2">
                        <Icon name="axe-chop" />
                        <span>{t('block.clearPlantation')}</span>
                        <span class="min-w-0 flex-1"></span>
                        <span class="num rounded-lg bg-black/15 px-1.5 py-0.5 text-xs">
                          {formatRp(danger.cost)}
                        </span>
                      </span>
                    </button>
                    {#if danger.rejection}
                      <div class="px-0.5 text-xs font-bold text-[#9e2e20]">{danger.rejection}</div>
                    {/if}
                  {:else}
                    <div class="flex flex-col gap-2" data-testid="clear-confirm">
                      <div class="font-bold text-[#9e2e20]">{t('block.clearConfirmTitle')}</div>
                      <ul class="list-disc pl-5 text-xs font-bold leading-snug text-[#8a4a3a]">
                        <li>
                          {t('block.clearLosesPalms', { n: danger.palms, what: danger.what })}
                        </li>
                        {#if danger.fruitKg > 0}
                          <li>{t('block.clearLosesFruit', { kg: formatKg(danger.fruitKg) })}</li>
                        {/if}
                        {#if danger.years > 0}
                          <li>{t('block.clearLosesYears', { n: danger.years })}</li>
                        {/if}
                        <li>
                          {t('block.clearCosts', {
                            cost: formatRp(danger.cost),
                            days: danger.days,
                          })}
                        </li>
                      </ul>
                      <div class="flex gap-2">
                        <button
                          class="btn btn-ghost flex-[2]"
                          data-testid="action-ClearPlantation-cancel"
                          onclick={() => panel.askClear(false)}
                        >
                          {t('block.cancel')}
                        </button>
                        <button
                          class="btn btn-red flex-1"
                          data-testid="action-ClearPlantation-confirm"
                          onclick={() => panel.confirmClear(danger.command)}
                        >
                          {t('block.confirmClear')}
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </footer>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* The same pressed-card edge the buttons carry, in the zone's own pink. */
  .danger {
    box-shadow: 0 3px 0 #e6a594;
  }

  .chevron {
    transition: transform 160ms ease;
  }

  .chevron.open {
    transform: rotate(180deg);
  }
</style>
