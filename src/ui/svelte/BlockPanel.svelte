<script lang="ts">
  import { t } from '../../i18n/index.ts';
  import { formatRp } from '../format.ts';

  import AutoHarvestToggle from './AutoHarvestToggle.svelte';
  import { blockView, type ActionView, type BlockPanel } from './blockPanelState.svelte.ts';
  import Icon from './Icon.svelte';

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
                <span>{t('block.onTrees')} <span class="num">{v.palms.bearing.kg}</span></span>
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
                  <div class="pill muted mt-2" data-testid="slot-detail">{p.grid.detail.text}</div>
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
            <div class="flex gap-1.5">
              {#each b.options as option (option.intensity)}
                <button
                  class="btn btn-sm flex-1 flex-col gap-0 {option.tips ? 'btn-red' : 'btn-orange'}"
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
    </div>
  {/if}
</div>
