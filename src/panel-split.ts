/**
 * The divider between the filter panel and the result list: drag it, or
 * focus it and use the arrow keys, to give one more room than the other.
 *
 * The choice is kept as a share of the space the two have between them, not
 * as pixels, so it survives a window resize or turning a phone round. It is
 * remembered in this browser only — a convenience, not a setting anybody else
 * sees — and the page works exactly as before if storage is unavailable.
 */

const STORAGE_KEY = 'uvm-trees:filters-share';
/** Enough for one filter heading, so the filters never vanish outright. */
const MIN_FILTERS_PX = 40;
/** Enough for the result count and its buttons plus a row of results. */
const MIN_RESULTS_PX = 110;
const KEY_STEP_PX = 32;

/** The filter height a drag or key press asks for, held inside the limits. */
export function clampFiltersHeight(wanted: number, available: number): number {
  const max = Math.max(MIN_FILTERS_PX, available - MIN_RESULTS_PX);
  return Math.round(Math.min(max, Math.max(MIN_FILTERS_PX, wanted)));
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
    // Private browsing or blocked storage: the split still works, it just
    // is not remembered.
  }
}

export function initPanelSplit(panel: HTMLElement, filters: HTMLElement, handle: HTMLElement): void {
  let share = readShare();

  /** Height the filters and results share: the panel less everything else in it. */
  const available = (): number => {
    let other = 0;
    for (const child of Array.from(panel.children) as HTMLElement[]) {
      if (child !== filters && !child.classList.contains('panel-results')) other += child.offsetHeight;
    }
    return panel.clientHeight - other;
  };

  const apply = (): void => {
    const room = available();
    if (share === null || room <= 0) {
      // The stylesheet's default split.
      filters.style.height = '';
      filters.style.maxHeight = '';
    } else {
      filters.style.height = `${clampFiltersHeight(share * room, room)}px`;
      filters.style.maxHeight = 'none';
    }
    const now = room > 0 ? filters.offsetHeight / room : 0;
    handle.setAttribute('aria-valuenow', String(Math.round(now * 100)));
  };

  const setHeight = (px: number): void => {
    const room = available();
    if (room <= 0) return;
    share = clampFiltersHeight(px, room) / room;
    writeShare(share);
    apply();
  };

  let startY = 0;
  let startH = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startY = e.clientY;
    startH = filters.offsetHeight;
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
    const h = filters.offsetHeight;
    if (e.key === 'ArrowUp') setHeight(h - KEY_STEP_PX);
    else if (e.key === 'ArrowDown') setHeight(h + KEY_STEP_PX);
    else if (e.key === 'Home') setHeight(0);
    else if (e.key === 'End') setHeight(Number.MAX_SAFE_INTEGER);
    else return;
    e.preventDefault();
  });

  // Back to the default split.
  handle.addEventListener('dblclick', () => {
    share = null;
    writeShare(null);
    apply();
  });

  window.addEventListener('resize', apply);
  apply();
}
