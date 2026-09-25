<script lang="ts">
  import { BIOMES } from '@sim/balance/biomes';
  import { FERTILIZER_DAYS, GROWTH } from '@sim/balance/growth';
  import { BEETLES, GANODERMA } from '@sim/balance/pests';
  import { seedlingsNeeded } from '@sim/commands/plantBlock';
  import { kopdesRange } from '@sim/kopdes';
  import { readBlock } from '@sim/state';

  import { t } from '../../../i18n/index.ts';
  import Icon from '../base/Icon.svelte';

  import { STEPS, runOf } from './steps.ts';
  import type { Tutorial } from './tutorialState.svelte.ts';

  interface Props {
    tutorial: Tutorial;
  }

  /** A rectangle in the overlay's own pixels. */
  interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  const { tutorial }: Props = $props();
  const ui = $derived(tutorial.ui);
  const step = $derived(tutorial.step);

  /** Breathing room between a target and its ring, and between the ring and the card. */
  const RING_PAD = 6;
  const CARD_GAP = 18;
  const EDGE = 12;

  let overlay = $state<HTMLElement | null>(null);
  let size = $state({ w: 0, h: 0 });
  let box = $state<Box | null>(null);
  let quad = $state<[number, number][] | null>(null);
  let cardW = $state(0);
  let cardH = $state(0);

  const same = (a: Box | null, b: Box | null): boolean =>
    a === b ||
    (a !== null &&
      b !== null &&
      Math.abs(a.x - b.x) < 0.5 &&
      Math.abs(a.y - b.y) < 0.5 &&
      Math.abs(a.w - b.w) < 0.5 &&
      Math.abs(a.h - b.h) < 0.5);

  const sameQuad = (a: [number, number][] | null, b: [number, number][] | null): boolean =>
    a === b ||
    (a !== null &&
      b !== null &&
      a.every((p, i) => Math.abs(p[0] - b[i]![0]) < 0.5 && Math.abs(p[1] - b[i]![1]) < 0.5));

  // The targets move: the aside slides in, the panel scrolls, the camera pans.
  // So the step's element and block are measured every frame while it is up.
  $effect(() => {
    const s = step;
    const root = overlay;

    void ui.generation;

    if (!s || !root) {
      box = null;
      quad = null;
      return;
    }

    let scrolled = false;
    let raf = 0;

    const measure = (): void => {
      const rect = root.getBoundingClientRect();

      if (Math.abs(rect.width - size.w) > 0.5 || Math.abs(rect.height - size.h) > 0.5) {
        size = { w: rect.width, h: rect.height };
      }

      let nextBox: Box | null = null;

      if (s.element) {
        const el = document.querySelector(`[data-testid="${s.element}"]`);

        if (el) {
          const r = el.getBoundingClientRect();
          const b = { x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height };

          // Off the edge is the aside still sliding, or a phone that is not up.
          if (b.w > 0 && b.h > 0 && b.x + b.w > EDGE && b.x < rect.width - EDGE) {
            nextBox = b;

            if (!scrolled) {
              el.scrollIntoView({ block: 'nearest' });
              scrolled = true;
            }
          }
        }
      }

      let nextQuad: [number, number][] | null = null;

      if (s.block) {
        const sim = tutorial.sim;
        const id =
          s.block === 'kopdes'
            ? (sim?.state.kopdes?.blockId ?? sim?.state.worldGen.kopdesBlock ?? null)
            : tutorial.field;
        const projected = id === null ? null : tutorial.handlers.project(id);

        if (projected) {
          const cx = projected.points.reduce((sum, p) => sum + p[0], 0) / 4;
          const cy = projected.points.reduce((sum, p) => sum + p[1], 0) / 4;

          if (cx > 0 && cx < rect.width && cy > 0 && cy < rect.height) nextQuad = projected.points;
        }
      }

      if (!same(box, nextBox)) box = nextBox;
      if (!sameQuad(quad, nextQuad)) quad = nextQuad;
      // A control that has gone is a loss even with its block still in view.
      tutorial.setLost(s.element ? nextBox === null : nextQuad === null);
      raf = requestAnimationFrame(measure);
    };

    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  });

  // The toasts stand where the pill does, so they climb over it while it is up.
  $effect(() => {
    document.documentElement.style.setProperty('--tutorial-lift', ui.active ? '4.75rem' : '0px');
  });

  /** The card's words for the step, with the balance numbers they quote. */
  const copy = $derived.by(() => {
    const s = step;
    const sim = tutorial.sim;

    if (!s || s.card !== 'own' || !sim) return null;

    const field = tutorial.field === null ? null : readBlock(sim.state, sim.world, tutorial.field);
    const biome = field?.biome ?? 'grassfield';
    const vars: Record<string, number> = {
      range: kopdesRange(1),
      days: BIOMES[biome].chopDays,
      n: seedlingsNeeded(biome),
      fertilizerDays: FERTILIZER_DAYS,
      trichodermaDays: GANODERMA.trichodermaDays,
      trapDays: BEETLES.trapDays,
    };
    const run = runOf(s);
    const eyebrow = run
      ? t(s.id.startsWith('shop') ? 'tutorial.shopOf' : 'tutorial.guideOf', run)
      : t(`tutorial.${s.id}Eyebrow`);

    return {
      eyebrow,
      head: t(`tutorial.${s.id}Head`, vars),
      body: t(`tutorial.${s.id}Body`, vars),
      run,
      last: run !== null && run.n === run.of,
    };
  });

  const anchor = $derived.by((): Box | null => {
    if (box) return box;
    if (!quad) return null;

    const xs = quad.map((p) => p[0]);
    const ys = quad.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);

    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  });

  /** Where the card sits: under a target in the top half, over one in the bottom half. */
  const placed = $derived.by(() => {
    const a = anchor;

    if (!a || cardW === 0) return null;

    const below = a.y + a.h / 2 < size.h / 2;
    const cx = a.x + a.w / 2;
    const x = Math.min(Math.max(cx - cardW / 2, EDGE), Math.max(EDGE, size.w - cardW - EDGE));
    const y = below ? a.y + a.h + CARD_GAP : a.y - CARD_GAP - cardH;

    return { x, y, below, arrowX: Math.min(Math.max(cx - x, 28), cardW - 28) };
  });

  const spotlight = $derived.by(() => {
    if (!quad) return null;

    const cx = quad.reduce((sum, p) => sum + p[0], 0) / 4;
    const cy = quad.reduce((sum, p) => sum + p[1], 0) / 4;
    const r = Math.max(...quad.map((p) => Math.hypot(p[0] - cx, p[1] - cy))) * 1.7;

    return { cx, cy: cy - r * 0.15, r };
  });

  const points = $derived(quad ? quad.map((p) => p.join(',')).join(' ') : '');
  const stepNumber = $derived(Math.min(ui.index + 1, STEPS.length));
  const title = $derived(step ? t(`tutorial.${step.id}Title`) : '');
</script>

{#snippet card(docked: boolean)}
  {#if copy}
    <div
      class="tut-card {docked ? '' : 'absolute'}"
      style={docked
        ? ''
        : placed
          ? `left: ${placed.x}px; top: ${placed.y}px`
          : 'visibility: hidden'}
      data-testid="tutorial-card"
      data-step={step?.id}
      bind:clientWidth={cardW}
      bind:clientHeight={cardH}
    >
      <div class="label text-[var(--coral-edge)]">{copy.eyebrow}</div>
      <div class="mt-0.5 text-lg font-extrabold leading-tight">{copy.head}</div>
      <p class="muted mt-1 text-sm leading-snug">{copy.body}</p>
      {#if step?.next}
        <div class="mt-3 flex items-center justify-between gap-3">
          <span class="flex items-center gap-1" aria-hidden="true">
            {#each Array.from({ length: copy.run?.of ?? 0 }, (_v, i) => i + 1) as dot (dot)}
              <i class="tut-dot" data-on={dot === copy.run?.n || undefined}></i>
            {/each}
          </span>
          <button
            class="btn btn-sm btn-coral"
            data-testid="tutorial-next"
            onclick={() => tutorial.next()}
          >
            {copy.last ? t('tutorial.done') : t('tutorial.next')}
          </button>
        </div>
      {/if}
      {#if !docked && placed}
        <svg
          class="tut-arrow {placed.below ? 'tut-arrow-up' : 'tut-arrow-down'}"
          style="left: {placed.arrowX}px"
          viewBox="0 0 24 14"
          aria-hidden="true"
        >
          <path d="M2 1 L12 12 L22 1" />
        </svg>
      {/if}
    </div>
  {/if}
{/snippet}

{#if ui.active}
  <div
    class="pointer-events-none absolute inset-0 z-[40]"
    data-testid="tutorial"
    data-step={step?.id ?? 'complete'}
    bind:this={overlay}
  >
    {#if step}
      <svg
        class="absolute inset-0 h-full w-full"
        viewBox="0 0 {size.w} {size.h}"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="tut-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <filter id="tut-edge" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <mask id="tut-mask">
            <rect x="0" y="0" width={size.w} height={size.h} fill="white" />
            {#if box}
              <rect
                x={box.x - RING_PAD - 6}
                y={box.y - RING_PAD - 6}
                width={box.w + (RING_PAD + 6) * 2}
                height={box.h + (RING_PAD + 6) * 2}
                rx="22"
                fill="black"
                filter="url(#tut-edge)"
              />
            {/if}
            {#if spotlight}
              <circle
                cx={spotlight.cx}
                cy={spotlight.cy}
                r={spotlight.r}
                fill="black"
                filter="url(#tut-soft)"
              />
            {/if}
          </mask>
        </defs>
        <rect x="0" y="0" width={size.w} height={size.h} class="tut-scrim" mask="url(#tut-mask)" />
        {#if quad}
          <polygon class="tut-glow" {points} filter="url(#tut-soft)" />
          <polygon class="tut-diamond" {points} />
          <polygon class="tut-diamond tut-diamond-ping" {points} />
        {/if}
        {#if box}
          <rect
            class="tut-ring"
            x={box.x - RING_PAD}
            y={box.y - RING_PAD}
            width={box.w + RING_PAD * 2}
            height={box.h + RING_PAD * 2}
            rx="20"
          />
          <rect
            class="tut-ring tut-ring-ping"
            x={box.x - RING_PAD}
            y={box.y - RING_PAD}
            width={box.w + RING_PAD * 2}
            height={box.h + RING_PAD * 2}
            rx="20"
          />
        {/if}
      </svg>

      {#if anchor}
        {@render card(false)}
      {/if}

      <div class="absolute bottom-16 left-[30px] z-[42] flex flex-col items-start gap-3">
        {#if !anchor}
          {@render card(true)}
        {/if}
        <div class="tut-pill" data-testid="tutorial-pill">
          <span class="label">{t('tutorial.pill')}</span>
          <span class="whitespace-nowrap font-extrabold">
            {t('tutorial.stepOf', { n: stepNumber, of: STEPS.length, title })}
          </span>
          <span class="gauge w-24" aria-hidden="true">
            <i style="width: {((stepNumber - 1) / STEPS.length) * 100}%"></i>
          </span>
          {#if ui.lost}
            <button
              class="btn btn-sm btn-coral"
              data-testid="tutorial-show"
              onclick={() => tutorial.showMe()}
            >
              {t('tutorial.showMe')}
            </button>
          {/if}
          <button
            class="btn btn-sm btn-ghost"
            data-testid="tutorial-skip"
            onclick={() => tutorial.skip()}
          >
            {t('tutorial.skip')}
          </button>
        </div>
      </div>
    {/if}
  </div>

  {#if ui.complete}
    <div
      class="absolute inset-0 z-[60] flex items-center justify-center bg-[rgba(74,51,32,0.55)] p-4"
    >
      <div
        class="card flex w-full max-w-md flex-col items-center p-7 text-center"
        data-testid="tutorial-complete"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-complete-title"
      >
        <span class="tut-crest"><Icon name="shop-bibit" class="h-8 w-8" /></span>
        <div class="label mt-4 text-[#2f7a2b]">{t('tutorial.completeLabel')}</div>
        <div id="tutorial-complete-title" class="mt-1 text-2xl font-extrabold leading-tight">
          {t('tutorial.completeTitle')}
        </div>
        <p class="muted mt-2 text-sm leading-relaxed">
          {t('tutorial.completeBody', { days: GROWTH.immatureDays })}
        </p>
        <div class="mt-5 flex w-full gap-3">
          <button
            class="btn btn-ghost btn-lg flex-1"
            data-testid="tutorial-replay"
            onclick={() => tutorial.replay()}
          >
            {t('tutorial.replay')}
          </button>
          <button
            class="btn btn-green btn-lg flex-1"
            data-testid="tutorial-finish"
            onclick={() => tutorial.finish()}
          >
            {t('tutorial.startPlaying')}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .tut-scrim {
    fill: rgb(38 28 16 / 0.42);
  }

  .tut-glow {
    fill: rgb(255 236 170 / 0.3);
  }

  /* The dashed diamond on the land, its dashes walking; the ping grows out of it. */
  .tut-diamond {
    fill: none;
    stroke: #fff8e6;
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 14 9;
    animation: tut-march 1.2s linear infinite;
  }

  .tut-diamond-ping {
    stroke: var(--gold-2);
    stroke-dasharray: none;
    transform-box: fill-box;
    transform-origin: center;
    animation: tut-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  .tut-ring {
    fill: none;
    stroke: var(--gold-2);
    stroke-width: 3;
  }

  .tut-ring-ping {
    transform-box: fill-box;
    transform-origin: center;
    animation: tut-ring-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @keyframes tut-march {
    to {
      stroke-dashoffset: -23;
    }
  }

  @keyframes tut-ping {
    0% {
      transform: scale(1);
      opacity: 0.9;
    }
    70%,
    100% {
      transform: scale(1.4);
      opacity: 0;
    }
  }

  @keyframes tut-ring-ping {
    0% {
      transform: scale(1);
      opacity: 0.85;
    }
    70%,
    100% {
      transform: scale(1.12);
      opacity: 0;
    }
  }

  .tut-card {
    pointer-events: auto;
    z-index: 41;
    width: min(19.5rem, calc(100vw - 24px));
    border-radius: 18px;
    border: 3px solid var(--coral-edge);
    background: #fffdf5;
    padding: 0.85rem 1rem 0.95rem;
    box-shadow:
      0 4px 0 var(--coral-edge),
      0 12px 28px rgb(74 51 32 / 0.28);
  }

  .tut-arrow {
    position: absolute;
    width: 24px;
    height: 14px;
    overflow: visible;
    margin-left: -12px;
  }

  .tut-arrow path {
    fill: #fffdf5;
    stroke: var(--coral-edge);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* The card sits under its target: the point looks up from the top edge. */
  .tut-arrow-up {
    top: -14px;
    rotate: 180deg;
  }

  .tut-arrow-down {
    bottom: -16px;
  }

  .tut-dot {
    display: block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: #e6d7ae;
    transition: width 160ms ease;
  }

  .tut-dot[data-on] {
    width: 1.1rem;
    background: var(--coral-2);
  }

  .tut-pill {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    border-radius: 18px;
    border: 2px solid var(--card-edge);
    background: var(--card);
    padding: 0.5rem 0.6rem 0.5rem 0.9rem;
    box-shadow:
      0 4px 0 var(--card-shadow),
      0 10px 24px rgb(74 51 32 / 0.18);
  }

  .tut-crest {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4rem;
    height: 4rem;
    border-radius: 18px;
    border: 3px solid var(--green-edge);
    background: #eaf7dd;
  }

  @media (prefers-reduced-motion: reduce) {
    .tut-diamond,
    .tut-diamond-ping,
    .tut-ring-ping {
      animation: none;
    }

    .tut-diamond-ping,
    .tut-ring-ping {
      opacity: 0;
    }
  }
</style>
