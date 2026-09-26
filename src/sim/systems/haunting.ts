import { blockHauntStage } from '../haunting.ts';
import type { SimContext } from '../state.ts';

export function haunting(ctx: SimContext): void {
  const { state, events } = ctx;

  for (const block of state.blocks.values()) {
    if (block.hauntedSince < 0) continue;

    // Nothing planted, nothing to haunt: felled, burned or buried, the block
    // goes quiet and the dead go back to sleep (GDD 3.11).
    if (block.phase !== 'planted' && block.phase !== 'reforesting') {
      block.hauntedSince = -1;
      events.push({ type: 'HauntingEnded', block: block.id });
      continue;
    }

    const stage = blockHauntStage(block, state.tick);

    if (stage !== 0 && stage !== blockHauntStage(block, state.tick - 1)) {
      events.push({ type: 'HauntingStage', block: block.id, stage });
    }
  }
}
