/**
 * A GNSS receiver — a Trimble R1, say — paired with a laptop over Bluetooth
 * and read directly by the page, through Chrome's Web Serial API.
 *
 * On a phone, Trimble Mobile Manager puts the receiver's position in place of
 * the phone's own, and the apps need nothing. Windows has no such app, so on a
 * laptop the page opens the receiver's Bluetooth serial port itself and reads
 * its NMEA sentences (src/gnss/nmea.ts). Corrections the receiver applies by
 * itself, such as SBAS, come through; Trimble's internet-delivered ones do not.
 *
 * Chrome and Edge on a desktop only. Elsewhere `receiverSupported()` is false
 * and the apps show no button.
 */

import { HDOP_TO_M, LineSplitter, parseGga, parseGst, qualityLabel, type Gst } from './nmea';

export interface ReceiverFix {
  lat: number;
  lng: number;
  /** Horizontal error in metres: the receiver's own (GST), or estimated from HDOP. */
  accuracy: number;
  /** True when `accuracy` was estimated from HDOP rather than reported. */
  estimated: boolean;
  quality: number;
  label: string;
  satellites: number;
  at: number;
}

export type ReceiverState =
  | { status: 'off' }
  | { status: 'connecting' }
  /**
   * Connected, no current position. `heard` says whether any NMEA has arrived
   * at all; `slow` that it has been quiet for STALE_MS, which is when an app
   * should start worrying out loud rather than just waiting.
   */
  | { status: 'waiting'; heard: boolean; slow: boolean }
  | { status: 'fix'; fix: ReceiverFix }
  | { status: 'lost'; message: string };

// The parts of Web Serial used here. TypeScript's DOM library does not have it.
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(options?: { allowedBluetoothServiceClassIds?: string[] }): Promise<SerialPortLike>;
  addEventListener(type: 'disconnect', listener: (e: Event) => void): void;
}
const serial = (): SerialLike | undefined => (navigator as unknown as { serial?: SerialLike }).serial;

export const receiverSupported = (): boolean => !!serial();

/** Bluetooth Serial Port Profile: lets Chrome offer a paired receiver's RFCOMM port. */
const SPP = '00001101-0000-1000-8000-00805f9b34fb';
/** No position for this long and the fix is called lost: the apps go back to the device's own. */
export const STALE_MS = 5000;

export class Receiver {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private lastGst: Gst | null = null;
  private lastFixAt = 0;
  private heard = false;
  private watchdog = 0;
  private closing = false;

  constructor(private readonly onState: (state: ReceiverState) => void) {}

  get connected(): boolean {
    return this.port !== null;
  }

  /** Must be called from a click: Chrome only shows its port picker then. */
  async connect(): Promise<void> {
    const s = serial();
    if (!s || this.port) return;
    let port: SerialPortLike;
    try {
      port = await s.requestPort({ allowedBluetoothServiceClassIds: [SPP] });
    } catch {
      return; // picker closed without a choice: nothing to report
    }
    this.onState({ status: 'connecting' });
    try {
      // Bluetooth serial ignores the speed, but the API requires one.
      await port.open({ baudRate: 115200 });
    } catch (err) {
      this.onState({ status: 'lost', message: `Could not open the receiver: ${(err as Error).message}` });
      return;
    }
    this.port = port;
    this.closing = false;
    this.heard = false;
    this.lastFixAt = 0;
    this.lastGst = null;
    s.addEventListener('disconnect', (e) => {
      if ((e.target as unknown) === port) void this.drop('The receiver disconnected.');
    });
    const connectedAt = Date.now();
    this.onState({ status: 'waiting', heard: false, slow: false });
    this.watchdog = window.setInterval(() => {
      const quietSince = Math.max(this.lastFixAt, connectedAt);
      if (this.port && Date.now() - this.lastFixAt > STALE_MS) {
        this.onState({ status: 'waiting', heard: this.heard, slow: Date.now() - quietSince > STALE_MS });
      }
    }, 1000);
    void this.read(port);
  }

  async disconnect(): Promise<void> {
    await this.drop(null);
  }

  private async read(port: SerialPortLike): Promise<void> {
    const lines = new LineSplitter();
    try {
      const text = port.readable!.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>);
      this.reader = text.getReader();
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        for (const line of lines.push(value)) this.line(line);
      }
    } catch (err) {
      if (!this.closing) await this.drop(`Lost the receiver: ${(err as Error).message}`);
      return;
    }
    if (!this.closing) await this.drop('The receiver stopped sending.');
  }

  /** One sentence. Public so the browser test can feed it lines without a port. */
  line(line: string): void {
    if (line.startsWith('$')) this.heard = true;
    const gst = parseGst(line);
    if (gst) {
      this.lastGst = gst;
      return;
    }
    const gga = parseGga(line);
    if (!gga) return;
    // A GST is used only if it is for this same moment; an old one would
    // describe a fix that has since changed.
    const gstNow = this.lastGst && this.lastGst.time === gga.time ? this.lastGst : null;
    const fix: ReceiverFix = {
      lat: gga.lat,
      lng: gga.lng,
      accuracy: gstNow ? gstNow.horizontal : Math.max(gga.hdop, 0.5) * HDOP_TO_M,
      estimated: !gstNow,
      quality: gga.quality,
      label: qualityLabel(gga.quality),
      satellites: gga.satellites,
      at: Date.now(),
    };
    this.lastFixAt = fix.at;
    this.onState({ status: 'fix', fix });
  }

  private async drop(message: string | null): Promise<void> {
    const port = this.port;
    if (!port) return;
    this.closing = true;
    this.port = null;
    clearInterval(this.watchdog);
    try { await this.reader?.cancel(); } catch { /* already gone */ }
    this.reader = null;
    try { await port.close(); } catch { /* already gone */ }
    this.onState(message ? { status: 'lost', message } : { status: 'off' });
  }
}

/** One line for the status display: "SBAS · 19 satellites · ±1.3 m". */
export function describeFix(fix: ReceiverFix): string {
  const acc = `±${fix.accuracy < 10 ? fix.accuracy.toFixed(1) : Math.round(fix.accuracy)} m${fix.estimated ? ' (estimated)' : ''}`;
  return `${fix.label} · ${fix.satellites} satellite${fix.satellites === 1 ? '' : 's'} · ${acc}`;
}

/** What to say while connected without a position. */
export function describeWaiting(state: { heard: boolean; slow: boolean }): { text: string; warn: boolean } {
  if (!state.slow) return { text: 'Receiver connected · waiting for its first position…', warn: false };
  // "Nothing at all" means the receiver is not sending positions to this port;
  // "something, but no position" means it has no fix yet.
  return state.heard
    ? { text: 'Receiver connected · no position from it yet. Is it out in the open?', warn: true }
    : { text: 'Receiver connected, but nothing is arriving from it. Is it on, and sending NMEA?', warn: true };
}
