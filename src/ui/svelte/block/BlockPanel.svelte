<script lang="ts">
  import { t } from '../../../i18n/index.ts';
  import { formatKg, formatRp } from '../../format.ts';
  import Icon from '../base/Icon.svelte';
  import Tooltip from '../base/Tooltip.svelte';

  import AutoHarvestToggle from './AutoHarvestToggle.svelte';
  import { blockView, type ActionView, type BlockPanel } from './blockPanelState.svelte.ts';
  import SlotCell from './SlotCell.svelte';

  interface Props {
    panel: BlockPanel;
  }

  // Matches `grid-cols-12` below: the tooltip needs to know which end it is at.
  const SLOT_COLUMNS = 12;
  const HARVEST_ID = 'action-HarvestBlock';

  const LAND_SWATCH: Record<string, string> = {
    bearing: '#3faa4c',
    immature: '#a7d178',
    forest: '#2f6b2e',
    bare: '#a8875a',
  };

  const { panel }: Props = $props();
  const ui = $derived(panel.ui);

  const view = $derived.by(() => {
    void ui.version;
    return panel.sim && ui.block !== null ? blockView(panel.sim, ui.block, ui.slot) : null;
  });
</script>

{#snippet landButton(action: ActionView)}
  <div>
    <button
      class="btn w-full justify-between !border-2 !border-[#b9d3f5] !bg-none !bg-[#eaf2fd] !text-[var(--ink)] !shadow-[0_3px_0_#b9d3f5] disabled:!border-[#e2d2a8] disabled:!bg-[var(--pill-muted)] disabled:!text-[var(--ink-3)] disabled:!shadow-[0_3px_0_#e2d2a8]"
      disabled={action.rejection !== null}
      title={action.rejection ?? ''}
      data-testid={action.testId}
      onclick={() => panel.act(action.command)}
    >
      <span class="flex items-center gap-2">
        {#if action.icon}<Icon name={action.icon} />{/if}{action.label}
      </span>
      {#if action.cost !== undefined}
        <span class="num rounded-lg bg-white/70 px-1.5 py-0.5 text-xs">{formatRp(action.cost)}</span
        >
      {/if}
    </button>
    {#if action.rejection}
      <div class="mt-0.5 px-1 text-xs font-bold text-[#b85e12]">{action.rejection}</div>
    {/if}
  </div>
{/snippet}

{#snippet actionButton(action: ActionView)}
  <div class="relative">
    <button
      class={action.minor ? 'btn btn-sm btn-ghost' : 'btn btn-lg w-full btn-green'}
      disabled={action.rejection !== null}
      title={action.rejection ?? ''}
      data-testid={action.testId}
      data-urgent={action.urgent || undefined}
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
            {#if v.kopdes}
              <div class="mt-0.5 flex flex-wrap items-center gap-2">
                <span class="chip chip-moss" data-testid="kopdes-level">
                  {t('block.level', { n: v.kopdes.level })}{v.kopdes.atMax
                    ? `, ${t('block.kopMax')}`
                    : ''}
                </span>
                <span class="muted text-xs font-bold">
                  {t('block.kopRange', { n: v.kopdes.range })}
                </span>
              </div>
            {:else}
              <div class="label" data-testid="block-phase">{v.phase}</div>
            {/if}
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
          <div class="grid gap-2 {v.kopdes ? 'grid-cols-3' : 'grid-cols-2'}">
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

          <!-- The water and ground work reads with the tiles it answers to,
               not after the pests at the foot of the panel. -->
          {#if v.minor.length > 0}
            <div class="grid grid-cols-2 gap-1.5" data-testid="land-work">
              {#each v.minor as action (action.testId)}
                {@render landButton(action)}
              {/each}
            </div>
          {/if}

          {#if v.kopdes}
            {@const k = v.kopdes}
            <div class="flex flex-col gap-3 text-xs" data-testid="kopdes-report">
              <button
                class="btn btn-lg w-full justify-between btn-coral"
                data-testid="action-OpenShop"
                onclick={() => panel.handlers.openShop()}
              >
                <span class="flex items-center gap-2">
                  <Icon name="kopdes" />{t('block.openShop')}
                </span>
                <span class="num rounded-lg bg-black/15 px-1.5 py-0.5 text-xs">
                  {t('block.kopItems', { n: k.shopItems })}
                </span>
              </button>

              <!-- What this Kopdes is worth to you: today's price, and the year. -->
              <div class="kop-price">
                <Icon name="tbs-fruit" class="h-6 w-6" />
                <div class="flex min-w-0 flex-1 items-end justify-between gap-2">
                  <div>
                    <div class="label">{t('block.kopPriceToday')}</div>
                    <div class="font-extrabold" data-testid="kopdes-price">
                      <span class="num">{k.price}</span><span class="muted text-[0.7rem]"
                        >{t('block.kopPerKg')}</span
                      >
                      <span class={k.trend === 'down' ? 'text-[#c94a30]' : 'text-[#3f8a34]'}>
                        {k.trend === 'flat' ? '' : k.trend === 'up' ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="label">{t('block.kopSoldYear')}</div>
                    <div class="num font-extrabold" data-testid="kopdes-sold">
                      {k.soldKg}, {k.soldRp}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div class="mb-1 flex items-baseline justify-between">
                  <span class="label">{t('block.kopInRange', { n: k.blocksInRange })}</span>
                  <span class="muted">{t('block.kopYours', { n: k.yours })}</span>
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                  {#each k.land as plot (plot.key)}
                    <div class="kop-stat">
                      <span class="kop-swatch" style="--swatch: {LAND_SWATCH[plot.key]}"></span>
                      <span class="min-w-0">
                        <span class="label block leading-none"
                          >{t(`block.kopLand_${plot.key}`)}</span
                        >
                        <span class="num font-extrabold"
                          >{t('block.kopHa', { n: plot.hectares })}</span
                        >
                      </span>
                    </div>
                  {/each}
                </div>
              </div>

              {#if k.crew}
                {@const c = k.crew}
                <div class="pill" data-testid="kopdes-crew">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="flex items-center gap-1.5 font-extrabold">
                      <Icon name="harvest-basket" />{t('block.kopCrew')}
                    </span>
                    <span class="muted">{c.nextRound ?? ''}</span>
                  </div>
                  <div class="mt-1.5 flex items-center gap-2">
                    <span class="gauge flex-1">
                      <i style="width: {c.ofBlocks ? (c.onAuto / c.ofBlocks) * 100 : 0}%"></i>
                    </span>
                    <span class="num shrink-0 font-extrabold">
                      {t('block.kopOnAuto', { on: c.onAuto, of: c.ofBlocks })}
                    </span>
                  </div>
                  <div class="mt-1 flex items-baseline justify-between gap-2">
                    <span class="num muted">
                      {t('block.kopPerRound', { rp: formatRp(c.perRound) })}
                    </span>
                    {#if c.unpicked > 0}
                      <span class="font-extrabold text-[#c94a30]">
                        {t('block.kopUnpicked', { n: c.unpicked })}
                      </span>
                    {/if}
                  </div>
                </div>
              {/if}

              <div>
                <div class="label mb-1">{t('block.kopStock')}</div>
                <div class="flex flex-wrap gap-1.5">
                  {#each k.stock as item (item.item)}
                    <span class="kop-stock" data-zero={item.count === 0 || undefined}>
                      <Icon name={item.icon} />{item.label}
                      <span class="num">{item.count}</span>
                    </span>
                  {/each}
                </div>
              </div>

              {#if k.attention.length > 0}
                <div class="kop-alert" data-testid="kopdes-attention">
                  <div class="label mb-1.5 text-[#b0402c]">{t('block.kopAttention')}</div>
                  <div class="flex flex-col gap-1.5">
                    {#each k.attention as row (row.block)}
                      <button
                        class="kop-alert-row"
                        data-testid={`kopdes-attention-${row.block}`}
                        onclick={() => panel.handlers.focus(row.block)}
                      >
                        <Icon name={row.kind === 'beetle' ? 'beetle' : 'ganoderma-mushroom'} />
                        <span class="min-w-0 flex-1 truncate">{row.label}</span>
                        <Icon name="chevron-right" />
                      </button>
                    {/each}
                  </div>
                </div>
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
            {@const p = v.palms}
            <div data-testid="stand-card">
              <div class="label mb-1">{p.caption}</div>
              <div class="stand" data-step={p.step}>
                <div class="flex items-center gap-2.5">
                  <span class="stand-crest"><Icon name={p.icon} class="h-6 w-6" /></span>
                  <div class="min-w-0 flex-1">
                    <div class="text-base font-extrabold leading-tight">
                      {p.heading}: <span class="num">{p.count}</span>
                    </div>
                    <div class="muted text-xs">{p.stageLine}</div>
                  </div>
                  <!-- The chip names the stage most of the stand is in; the
                       breakdown that used to crowd the card is behind it. -->
                  <Tooltip text={p.stages} tone="deep" withArrow align="end">
                    {#if p.bearing?.ripe}
                      <span
                        class="chip chip-coral flex items-center gap-1"
                        data-testid="stand-chip"
                      >
                        <Icon name="harvest-basket" />
                        {t('block.standHarvest')}
                      </span>
                    {:else}
                      <span
                        class="chip {p.step === 3 ? 'chip-moss' : 'chip-cream'}"
                        data-testid="stand-chip">{p.stage}</span
                      >
                    {/if}
                  </Tooltip>
                </div>

                <div class="mt-2 flex items-center gap-2">
                  <span class="stand-bar" aria-hidden="true">
                    {#each [1, 2, 3] as segment (segment)}
                      <span
                        class="stand-seg"
                        style="--seg: {p.step > segment ? 1 : p.step === segment ? p.fill : 0}"
                      ></span>
                    {/each}
                  </span>
                  {#if p.figure}
                    <span
                      class="flex shrink-0 items-center gap-1.5 text-xs font-extrabold"
                      data-testid={p.growth ? 'growth-progress' : 'harvest-info'}
                    >
                      <span class="num">{p.figure}</span>
                      {#if p.bearing?.full}
                        <span
                          class="chip chip-pest !px-2 !py-0.5 !text-[0.68rem]"
                          title={t('block.onTreesFullNote')}
                          data-testid="harvest-max">{t('block.onTreesFull')}</span
                        >
                      {/if}
                    </span>
                  {/if}
                </div>

                <div class="muted mt-1.5 text-xs leading-snug">
                  {p.note}
                  {#if p.bearing?.note}
                    <span
                      class={p.bearing.ripe ? 'font-extrabold text-[#c94a30]' : 'muted'}
                      data-testid="harvest-note">{p.bearing.note}</span
                    >
                  {/if}
                </div>
              </div>
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

              <!-- Two across: at three, a name as long as Metarhizium wrapped. -->
              <div class="mt-2 grid grid-cols-2 gap-1.5">
                {#each p.treatments as action (action.testId)}
                  {@render actionButton(action)}
                {/each}
              </div>

              {#if p.grid}
                <div class="mt-2">
                  <div class="label mb-1">{t('block.bySlot')}</div>
                  <div class="grid grid-cols-12 gap-1" data-testid="slot-grid">
                    {#each p.grid.cells as cell, i (cell.slot)}
                      <SlotCell
                        {...cell}
                        row={Math.floor(i / SLOT_COLUMNS)}
                        column={i % SLOT_COLUMNS}
                        columns={SLOT_COLUMNS}
                        pick={() => panel.toggleSlot(cell.slot)}
                      />
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
          {@const auto = v.kopdes ? null : v.autoHarvest}
          {@const picking = auto ? v.major.find((a) => a.testId === HARVEST_ID) : undefined}
          {@const rest = picking ? v.major.filter((a) => a !== picking) : v.major}
          <footer class="flex flex-col gap-2 border-t-2 border-dashed border-[#f2e0b0] p-4">
            <!-- Picking and who does the picking are one question, so they
                 share a row and the reason sits under both (GDD 8 panel 18a). -->
            {#if auto && picking}
              <div class="label">
                {auto.on
                  ? t('block.footerAutoOn')
                  : v.palms?.bearing?.ripe
                    ? t('block.footerAutoOffRipe')
                    : t('block.footerAutoOff')}
              </div>
              <div class="grid grid-cols-2 items-stretch gap-2">
                <button
                  class="btn btn-lg h-full w-full justify-between btn-green"
                  disabled={picking.rejection !== null}
                  title={picking.rejection ?? ''}
                  data-testid={picking.testId}
                  onclick={() => panel.act(picking.command)}
                >
                  <span class="flex items-center gap-2">
                    {#if picking.icon}<Icon name={picking.icon} />{/if}{picking.label}
                  </span>
                  {#if picking.badge !== undefined}
                    <span class="num rounded-lg bg-black/15 px-1.5 py-0.5 text-xs"
                      >{picking.badge}</span
                    >
                  {/if}
                </button>
                <AutoHarvestToggle on={auto.on} toggle={() => panel.act(auto.command)} paired />
              </div>
              {#if picking.rejection}
                <div class="px-1 text-xs font-bold text-[#b85e12]">{picking.rejection}</div>
              {/if}
            {/if}

            {#each rest as action (action.testId)}
              {@render actionButton(action)}
            {/each}
            {#if auto && !picking}
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
