/**
 * On a phone the panel sits above the map. The bar between them can be
 * dragged up or down (or focused and moved with the arrow keys) to give one
 * more room than the other: the map to work on trees, the panel to read one.
 *
 * The choice is kept as a share of the height the two have between them, not
 * as pixels, so it survives turning the phone round. It is remembered in this
 * browser only, and the page works as before if storage is unavailable.
 * On a wider screen the panel is beside the map and the bar is hidden; any
 * height set on a phone is put aside there and comes back on a phone.
 *
 * No Leaflet here, so the limits can be tested without a browser.
 */

const STORAGE_KEY = 'uvm-trees:positions-side-share';
/** Enough for the search box, so the panel never vanishes outright. */
export const MIN_SIDE_PX = 56;
/** Enough map to see a few trees and drag one. */
export const MIN_MAP_PX = 140;
const KEY_STEP_PX = 40;
const PHONE = '(max-width: 48rem)';

/** The panel height a drag or key press asks for, held inside the limits. */
export function clampSideHeight(wanted: number, available: number): number {
  const max = Math.max(MIN_SIDE_PX, available - MIN_MAP_PX);
  return Math.round(Math.min(max, Math.max(MIN_SIDE_PX, wanted)));
}

function readShare(): number | null {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return n > 0 && n < 1 ? n : null;
  } catch {
    return null;
  }
}

function writeShare(share: number | null): void {
  try {
    if (share === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, share.toFixed(3));
  } catch {
    // Private browsing or blocked storage: the bar still works, the height
    // just is not remembered.
  }
}

export function initSideSplit(
  layout: HTMLElement, side: HTMLElement, handle: HTMLElement, onResize: () => void,
): void {
  const phone = window.matchMedia(PHONE);
  let share = readShare();

  /** Height the panel and the map share: the layout less the bar itself. */
  const available = (): number => layout.clientHeight - handle.offsetHeight;

  const apply = (): void => {
    const room = available();
    if (!phone.matches || share === null || room <= 0) {
      // The stylesheet's own layout.
      side.style.height = '';
      side.style.maxHeight = '';
    } else {
      side.style.height = `${clampSideHeight(share * room, room)}px`;
      side.style.maxHeight = 'none';
    }
    const now = room > 0 ? side.offsetHeight / room : 0;
    handle.setAttribute('aria-valuenow', String(Math.round(now * 100)));
    onResize();
  };

  const setHeight = (px: number): void => {
    const room = available();
    if (room <= 0) return;
    share = clampSideHeight(px, room) / room;
    writeShare(share);
    apply();
  };

  let startY = 0;
  let startH = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    startY = e.clientY;
    startH = side.offsetHeight;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    setHeight(startH + (e.clientY - startY));
  });
  const stop = (e: PointerEvent): void => {
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    handle.classList.remove('is-dragging');
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);

  handle.addEventListener('keydown', (e) => {
    const h = side.offsetHeight;
    if (e.key === 'ArrowUp') setHeight(h - KEY_STEP_PX);
    else if (e.key === 'ArrowDown') setHeight(h + KEY_STEP_PX);
    else if (e.key === 'Home') setHeight(0);
    else if (e.key === 'End') setHeight(Number.MAX_SAFE_INTEGER);
    else return;
    e.preventDefault();
  });

  // Back to the default height.
  handle.addEventListener('dblclick', () => {
    share = null;
    writeShare(null);
    apply();
  });

  window.addEventListener('resize', apply);
  phone.addEventListener('change', apply);
  apply();
}
