<script lang="ts">
  import Tooltip from '../../ui/svelte/Tooltip.svelte';

  import { SUBJECT_GROUPS, type ActionId } from './subjects.ts';
  import {
    BACKDROPS,
    LOOP_IDS,
    ONE_SHOT_IDS,
    type WorkbenchPanel,
  } from './workbenchState.svelte.ts';

  interface Props {
    panel: WorkbenchPanel;
  }

  const { panel }: Props = $props();

  let query = $state('');
  const hits = $derived(
    panel.subjects.filter((s) => s.label.toLowerCase().includes(query.trim().toLowerCase())),
  );

  const ACTION_NOTE: Record<ActionId, string> = {
    walk: 'Move it along the ground.',
    idle: 'Stand it still, in its resting pose.',
    sit: 'Sit it down.',
    climb: 'Put it up a tree.',
    sleep: 'Curl it up asleep.',
    rear: 'Rear it onto its hind legs.',
    work: 'Play its working animation.',
    burst: 'Fire the effect once.',
    reset: 'Back to how it arrived.',
  };

  const can = (action: ActionId): boolean => panel.available.includes(action);
  const num = (n: number): string => n.toLocaleString('en-US');
  const mb = (bytes: number): string => `${(bytes / 1_048_576).toFixed(1)} MB`;
</script>

<!-- Left: the catalogue. -->
<aside class="rail left-3" data-testid="workbench-catalogue">
  <h1 class="mb-1 text-lg font-extrabold">Workbench</h1>
  <p class="label mb-2">{panel.subjects.length} subjects</p>
  <input
    class="pill mb-2 w-full border-none text-sm outline-none"
    type="search"
    placeholder="Filter"
    bind:value={query}
    data-testid="workbench-filter"
  />
  <div class="min-h-0 flex-1 overflow-y-auto pr-1">
    {#each SUBJECT_GROUPS as group (group)}
      {@const inGroup = hits.filter((s) => s.group === group)}
      {#if inGroup.length > 0}
        <p class="label mt-2 mb-1">{group}</p>
        {#each inGroup as subject (subject.id)}
          <button
            class="w-full rounded-lg px-2 py-1 text-left text-sm font-bold {panel.selected ===
            subject.id
              ? 'bg-[var(--green-2)] text-white'
              : 'hover:bg-[var(--pill)]'}"
            data-testid="workbench-subject"
            data-subject={subject.id}
            onclick={() => panel.handlers.select(subject.id)}
          >
            {subject.label}
          </button>
        {/each}
      {/if}
    {/each}
    {#if hits.length === 0}
      <p class="muted mt-3 text-sm">Nothing matches "{query}".</p>
    {/if}
  </div>
</aside>

<!-- Right: what it can be asked to do, and what it costs to draw. -->
<aside class="rail right-3" data-testid="workbench-controls">
  <p class="label mb-1">Behaviour</p>
  <div class="mb-3 flex flex-col gap-1.5">
    {#each panel.actions as action (action)}
      <Tooltip
        text={can(action) ? ACTION_NOTE[action] : `This subject has no ${action}() to call.`}
        placement="left"
        class="w-full"
      >
        <button
          class="btn btn-sm w-full {can(action) ? 'btn-green' : 'btn-ghost'}"
          disabled={!can(action)}
          data-testid="workbench-action"
          data-action={action}
          onclick={() => panel.handlers.run(action)}
        >
          {action}
        </button>
      </Tooltip>
    {/each}
  </div>

  <p class="label mb-1">Backdrop</p>
  <div class="mb-3 grid grid-cols-4 gap-1.5">
    {#each BACKDROPS as backdrop (backdrop.id)}
      <Tooltip text={backdrop.label} placement="left">
        <button
          class="h-7 w-full rounded-lg border-2"
          style="background: {backdrop.swatch}; border-color: {panel.backdrop === backdrop.id
            ? 'var(--green-2)'
            : 'var(--card-edge)'}"
          aria-label={backdrop.label}
          data-testid="workbench-backdrop"
          data-backdrop={backdrop.id}
          onclick={() => panel.handlers.setBackdrop(backdrop.id)}
        ></button>
      </Tooltip>
    {/each}
  </div>

  <p class="label mb-1">Stage</p>
  <div class="mb-3 flex gap-1.5">
    <button
      class="btn btn-sm flex-1 {panel.grid ? 'btn-green' : 'btn-ghost'}"
      data-testid="workbench-grid"
      onclick={() => panel.handlers.setGrid(!panel.grid)}
    >
      Ground
    </button>
    <button
      class="btn btn-sm flex-1 {panel.spin ? 'btn-green' : 'btn-ghost'}"
      data-testid="workbench-spin"
      onclick={() => panel.handlers.setSpin(!panel.spin)}
    >
      Spin
    </button>
    <Tooltip text="Bloom: anything brighter than white glows." placement="left">
      <button
        class="btn btn-sm {panel.glow ? 'btn-green' : 'btn-ghost'}"
        data-testid="workbench-glow"
        onclick={() => panel.handlers.setGlow(!panel.glow)}
      >
        Glow
      </button>
    </Tooltip>
  </div>

  <p class="label mb-1">Sound</p>
  <div class="mb-2 flex flex-wrap gap-1.5" data-testid="workbench-sounds">
    {#each ONE_SHOT_IDS as id (id)}
      <button
        class="btn btn-sm btn-ghost !px-2 !text-[0.68rem]"
        data-testid="workbench-sound"
        data-sound={id}
        onclick={() => panel.handlers.playSound(id)}
      >
        {id.replace(/^ui-/, '')}
      </button>
    {/each}
  </div>
  <div class="mb-2 flex flex-wrap gap-1.5">
    {#each LOOP_IDS as id (id)}
      <button
        class="btn btn-sm !px-2 !text-[0.68rem] {panel.looping.includes(id)
          ? 'btn-green'
          : 'btn-ghost'}"
        data-testid="workbench-loop"
        data-loop={id}
        onclick={() => panel.handlers.toggleLoop(id)}
      >
        {id}
      </button>
    {/each}
  </div>
  <label class="mb-3 flex items-center gap-2 text-xs">
    <span class="muted w-12 shrink-0">volume</span>
    <input
      class="flex-1"
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={panel.volume}
      data-testid="workbench-volume"
      oninput={(e) => panel.handlers.setVolume(Number(e.currentTarget.value))}
    />
  </label>
  {#if !panel.audioReady}
    <p class="muted mb-3 text-[0.7rem] leading-snug" data-testid="workbench-audio-hint">
      The audio context starts on the first press: a browser will not make a sound before the player
      asks for one.
    </p>
  {/if}

  <p class="label mb-1">Renderer</p>
  {#if panel.stats}
    {@const s = panel.stats}
    <dl class="num grid grid-cols-2 gap-x-2 text-xs" data-testid="workbench-stats">
      <dt class="muted">backend</dt>
      <dd class="text-right">{s.backend}</dd>
      <dt class="muted">fps</dt>
      <dd class="text-right">{s.fps}</dd>
      <dt class="muted">draws</dt>
      <dd class="text-right">{num(s.drawCalls)}</dd>
      <dt class="muted">tris</dt>
      <dd class="text-right">{num(s.triangles)}</dd>
      <dt class="muted">geometries</dt>
      <dd class="text-right" data-testid="workbench-geometries">{num(s.geometries)}</dd>
      <dt class="muted">textures</dt>
      <dd class="text-right">{num(s.textures)}</dd>
      <dt class="muted">programs</dt>
      <dd class="text-right">{num(s.programs)}</dd>
      <dt class="muted">gpu memory</dt>
      <dd class="text-right" data-testid="workbench-bytes">{mb(s.bytes)}</dd>
    </dl>
    <p class="muted mt-2 text-[0.7rem] leading-snug">
      Geometries and textures are GPU memory. They should come back to where they started after
      switching subjects; if they climb, something is not being disposed.
    </p>
  {/if}

  {#if panel.error}
    <p class="mt-2 text-xs font-bold text-[var(--red)]" data-testid="workbench-error">
      {panel.error}
    </p>
  {/if}
</aside>

<style>
  .rail {
    position: absolute;
    top: 0.75rem;
    bottom: 0.75rem;
    width: 14rem;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: 18px;
    box-shadow:
      0 5px 0 var(--card-shadow),
      0 14px 30px rgb(0 0 0 / 0.25);
    padding: 0.75rem;
    /* Visible, so a tooltip can hang outside the rail it belongs to. The
       catalogue scrolls in its own box instead. */
    overflow: visible;
  }
</style>
