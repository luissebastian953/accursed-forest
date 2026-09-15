/**
 * Keyboard shortcuts (§6.2, §8): space pauses, 1/2/3 pick a speed, Q/E snap
 * the camera a quarter turn, F jumps to the Kopdes, K opens the shop, Escape
 * closes things.
 */

import type { Speed } from '@app/timeControl';

export interface KeyHandlers {
  togglePause(): void;
  setSpeed(speed: Speed): void;
  rotate(direction: 1 | -1): void;
  focusKopdes(): void;
  openShop(): void;
  openNews(): void;
  escape(): void;
}

export function attachKeys(handlers: KeyHandlers, target: Window = window): () => void {
  const onKey = (event: KeyboardEvent): void => {
    const el = event.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        handlers.togglePause();
        break;
      case '1':
        handlers.setSpeed(1);
        break;
      case '2':
        handlers.setSpeed(5);
        break;
      case '3':
        handlers.setSpeed(20);
        break;
      case 'q':
      case 'Q':
        handlers.rotate(-1);
        break;
      case 'e':
      case 'E':
        handlers.rotate(1);
        break;
      case 'f':
      case 'F':
        handlers.focusKopdes();
        break;
      case 'n':
      case 'N':
        handlers.openNews();
        break;
      case 'k':
      case 'K':
        handlers.openShop();
        break;
      case 'Escape':
        handlers.escape();
        break;
      default:
        return;
    }
  };

  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
