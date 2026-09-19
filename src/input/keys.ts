import type { Speed } from '@app/timeControl';

export interface KeyHandlers {
  togglePause(): void;
  setSpeed(speed: Speed): void;
  rotate(direction: 1 | -1): void;
  focusKopdes(): void;
  openShop(): void;
  openNews(): void;
  toggleHelp(): void;
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
        handlers.setSpeed(10);
        break;
      case '3':
        handlers.setSpeed(50);
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
      case 'h':
      case 'H':
      case '?':
        handlers.toggleHelp();
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
