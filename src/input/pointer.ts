export interface Ndc {
  x: number;
  y: number;
}

export interface PointerHandlers {
  onClick(ndc: Ndc): void;
  onDoubleClick(ndc: Ndc): void;
}

const CLICK_SLOP_PX = 5;
const CLICK_MAX_MS = 350;
const DOUBLE_CLICK_MS = 320;

export function attachPointer(element: HTMLElement, handlers: PointerHandlers): () => void {
  let downX = 0;
  let downY = 0;
  let downAt = 0;
  let lastClickAt = -Infinity;
  let pointerDown = false;

  const toNdc = (event: PointerEvent): Ndc => {
    const rect = element.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    };
  };

  const onDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    pointerDown = true;
    downX = event.clientX;
    downY = event.clientY;
    downAt = performance.now();
  };

  const onUp = (event: PointerEvent): void => {
    if (!pointerDown || event.button !== 0) return;
    pointerDown = false;

    const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
    const held = performance.now() - downAt;

    if (moved > CLICK_SLOP_PX || held > CLICK_MAX_MS) return;

    const ndc = toNdc(event);
    const now = performance.now();

    if (now - lastClickAt < DOUBLE_CLICK_MS) {
      lastClickAt = -Infinity;
      handlers.onDoubleClick(ndc);
    } else {
      lastClickAt = now;
      handlers.onClick(ndc);
    }
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointerup', onUp);

  return () => {
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointerup', onUp);
  };
}
