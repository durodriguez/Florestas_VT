/**
 * The divider between the map and the sheet along the bottom while a tour is
 * walked, on a phone: drag it up for more of the note, down for more map, or
 * focus it and use the arrow keys. Double-click (or double-tap) puts the
 * sheet back to fit its contents.
 *
 * Kept as a share of the screen's height, so it survives turning the phone
 * round, and remembered in this browser only; the page works as before if
 * storage is unavailable. On a desktop the sheet is a card at the left and
 * the divider is hidden.
 */

const STORAGE_KEY = 'uvm-trees:fg-sheet-share';
/** Enough for the tour's name, the stop's name and the Next button. */
export const MIN_SHEET_PX = 150;
/** Always leave some map showing above the sheet. */
export const MAX_SHEET_SHARE = 0.85;
const KEY_STEP_PX = 32;

/**
 * The sheet height a drag or key press asks for, held inside the limits: no
 * shorter than the minimum, no taller than its contents (`natural`, so a drag
 * up never opens empty space under them) or most of the screen.
 */
export function clampSheetHeight(wanted: number, viewport: number, natural = Infinity): number {
  const max = Math.max(MIN_SHEET_PX, Math.min(natural, Math.floor(viewport * MAX_SHEET_SHARE)));
  return Math.round(Math.min(max, Math.max(MIN_SHEET_PX, wanted)));
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
    // Private browsing or blocked storage: the divider still works.
  }
}

export interface SheetSplit {
  /** Turn the divider on (a tour started) or off (it ended). */
  enable(on: boolean): void;
  /** Fit again after the sheet's contents change (another stop). */
  refit(): void;
}

/** `moved` is called after a drag or key press ends, to re-centre the map. */
export function initSheetSplit(sheet: HTMLElement, handle: HTMLElement, moved: () => void): SheetSplit {
  let share = readShare();
  let on = false;
  const phone = window.matchMedia('(max-width: 47.99rem)');

  const apply = (): void => {
    if (!on || !phone.matches || share === null) {
      sheet.style.height = '';
      sheet.style.maxHeight = '';
    } else {
      sheet.style.height = `${clampSheetHeight(share * window.innerHeight, window.innerHeight, natural())}px`;
      sheet.style.maxHeight = 'none';
    }
    handle.setAttribute('aria-valuenow', String(Math.round((sheet.offsetHeight / window.innerHeight) * 100)));
  };

  /** The sheet's height with nothing set: what its contents need. */
  const natural = (): number => {
    const [h, m] = [sheet.style.height, sheet.style.maxHeight];
    sheet.style.height = '';
    sheet.style.maxHeight = 'none';
    const px = sheet.offsetHeight;
    [sheet.style.height, sheet.style.maxHeight] = [h, m];
    return px;
  };

  const setHeight = (px: number): void => {
    share = clampSheetHeight(px, window.innerHeight, natural()) / window.innerHeight;
    writeShare(share);
    apply();
  };

  let startY = 0;
  let startH = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startY = e.clientY;
    startH = sheet.offsetHeight;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    // Dragging up makes the sheet taller.
    setHeight(startH - (e.clientY - startY));
  });
  const stop = (e: PointerEvent): void => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove('is-dragging');
    moved();
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);

  handle.addEventListener('keydown', (e) => {
    const h = sheet.offsetHeight;
    if (e.key === 'ArrowUp') setHeight(h + KEY_STEP_PX);
    else if (e.key === 'ArrowDown') setHeight(h - KEY_STEP_PX);
    else if (e.key === 'Home') setHeight(Number.MAX_SAFE_INTEGER);
    else if (e.key === 'End') setHeight(0);
    else return;
    e.preventDefault();
    moved();
  });

  handle.addEventListener('dblclick', () => {
    share = null;
    writeShare(null);
    apply();
    moved();
  });

  window.addEventListener('resize', apply);
  phone.addEventListener('change', apply);

  return {
    enable(next: boolean): void {
      on = next;
      handle.hidden = !next;
      sheet.classList.toggle('fg-sheet--split', next);
      apply();
    },
    refit: apply,
  };
}
