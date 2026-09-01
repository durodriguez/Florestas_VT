/**
 * Position capture.
 *
 * A phone's own GPS is 3–10 m, which is too coarse to place a tree in the right
 * bed. Three things push back on that: the fix is watched continuously so it can
 * settle, the accuracy is always shown rather than hidden, and a fix worse than
 * the warning threshold is flagged before it can be saved. The surveyor can also
 * drag the pin onto the crown on satellite imagery, which usually beats the
 * receiver outright.
 *
 * An external Bluetooth GNSS receiver set as Android's mock location provider
 * replaces the system fix, and this code picks it up with no changes.
 */

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

/** Above this many metres, the app says the fix is not good enough yet. */
export const ACCURACY_WARN_M = 10;
/** At or below this, the fix is good enough for an arboretum record. */
export const ACCURACY_GOOD_M = 5;

export type GpsState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'fixed'; fix: Fix }
  | { status: 'denied' }
  | { status: 'unavailable'; message: string };

export class Gps {
  private watchId: number | null = null;
  private best: Fix | null = null;

  constructor(private readonly onChange: (state: GpsState) => void) {}

  get bestFix(): Fix | null {
    return this.best;
  }

  start(): void {
    if (!('geolocation' in navigator)) {
      this.onChange({ status: 'unavailable', message: 'This device has no location support.' });
      return;
    }
    if (this.watchId !== null) return;
    this.onChange({ status: 'locating' });

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: Fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: pos.timestamp,
        };
        // Keep the tightest fix seen, so walking under a tree does not throw
        // away a good reading taken a moment earlier in the open.
        if (!this.best || fix.accuracy <= this.best.accuracy) this.best = fix;
        this.onChange({ status: 'fixed', fix: this.best });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.onChange({ status: 'denied' });
        } else {
          this.onChange({ status: 'unavailable', message: err.message || 'No position yet.' });
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Forget the retained best fix — call this when moving to the next tree.
   * Reports the reset so the display does not keep showing the previous
   * tree's accuracy until the next position callback arrives.
   */
  reset(): void {
    this.best = null;
    this.onChange({ status: 'locating' });
  }
}

export function accuracyLabel(m: number): { text: string; level: 'good' | 'fair' | 'poor' } {
  if (m <= ACCURACY_GOOD_M) return { text: `±${m.toFixed(0)} m`, level: 'good' };
  if (m <= ACCURACY_WARN_M) return { text: `±${m.toFixed(0)} m`, level: 'fair' };
  return { text: `±${m.toFixed(0)} m`, level: 'poor' };
}
