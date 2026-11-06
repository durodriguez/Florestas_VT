import L from 'leaflet';
import { accuracyLabel } from './accuracy';
import { describeFix, describeWaiting, mountLog, Receiver, receiverSupported, type ReceiverState } from '../gnss/receiver';

/**
 * "You are here" for checking positions in the field: a blue dot that follows
 * the device, inside a shaded circle the size of the accuracy the device
 * reports. The circle is the point. Phone GPS is commonly off by 3–10 m, the
 * same size as the corrections this tool makes, so a dot on its own would
 * invite moving trees to where the phone *thinks* it is.
 *
 * The toggle is ◎ in the header, the same button as the public map's "Find
 * plants near me". What it reports (accuracy, a lost signal) shows on the map
 * under the zoom buttons, where there is room for a sentence.
 *
 * Neither shape takes the pointer: trees under them stay draggable.
 *
 * On a laptop with Chrome or Edge, **Receiver** in the header connects a
 * Bluetooth GNSS receiver (a Trimble R1) directly; while it is connected its
 * positions drive the dot instead of the laptop's own (src/gnss/receiver.ts).
 * If it drops, the dot goes back to the laptop's location and says so.
 */

export interface Fix { lat: number; lng: number; accuracy: number }

export function initLocate(map: L.Map, btn: HTMLButtonElement, receiverBtn?: HTMLButtonElement): void {
  map.createPane('you');
  const pane = map.getPane('you')!;
  pane.style.zIndex = '640';
  pane.style.pointerEvents = 'none';

  const ring = L.circle([0, 0], {
    pane: 'you', radius: 1, interactive: false,
    color: '#1d6fe0', weight: 1, fillColor: '#1d6fe0', fillOpacity: 0.12,
  });
  const dot = L.circleMarker([0, 0], {
    pane: 'you', radius: 7, interactive: false,
    color: '#ffffff', weight: 3, fillColor: '#1d6fe0', fillOpacity: 1,
  });

  let msg!: HTMLElement;
  const Status = L.Control.extend({
    onAdd() {
      msg = L.DomUtil.create('div', 'locate-msg');
      msg.setAttribute('role', 'status');
      L.DomEvent.disableClickPropagation(msg);
      return msg;
    },
  });
  new Status({ position: 'topleft' }).addTo(map);

  const say = (text: string, warn = false): void => {
    msg.textContent = text;
    msg.classList.toggle('is-warn', warn);
  };

  let watch: number | null = null;
  let centered = false;
  /** ◎ is on: the dot is wanted, from whichever source is live. */
  let tracking = false;
  let receiver: Receiver | null = null;
  /** Set when the receiver was lost, so the device's own fixes say so until it is back. */
  let fallback = '';

  const setPressed = (on: boolean): void => {
    btn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Stop showing where I am (or bring the dot back on screen)' : 'Show where I am';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  };

  const stopDevice = (): void => {
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
  };

  const stop = (): void => {
    tracking = false;
    stopDevice();
    ring.remove();
    dot.remove();
    setPressed(false);
    say('');
  };

  const show = ({ lat, lng, accuracy }: Fix, source?: string): void => {
    ring.setLatLng([lat, lng]).setRadius(accuracy).addTo(map);
    dot.setLatLng([lat, lng]).addTo(map);
    // A receiver says more than the accuracy (its fix type and satellites);
    // past ±15 m either way, the warning that it is too rough is kept.
    const rough = accuracy > 15;
    say(source ? `${source}${rough ? ' — too rough to place trees by' : ''}` : accuracyLabel(accuracy), rough);
    // Center once, on the first fix. After that the map stays where the
    // surveyor puts it: it is in use, and a map that keeps jumping back to
    // the dot cannot be worked on.
    if (!centered) {
      centered = true;
      map.setView([lat, lng], Math.max(map.getZoom(), 19));
    }
  };

  /** The device's own location: the browser's, or a phone's mock-location receiver. */
  const startDevice = (): void => {
    if (watch !== null) return;
    if (!navigator.geolocation) {
      say('This browser cannot share its location.', true);
      return;
    }
    watch = navigator.geolocation.watchPosition(
      (pos) => show(
        { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
        fallback ? `${fallback} · this device ±${Math.max(1, Math.round(pos.coords.accuracy))} m` : undefined,
      ),
      (err) => {
        // Only a refusal ends it. A timeout or a dropped signal is normal
        // walking among buildings, and the watch keeps going.
        if (err.code === err.PERMISSION_DENIED) {
          stop();
          say('Location is blocked. Allow it for this site in the browser settings.', true);
        } else {
          say(map.hasLayer(dot) ? 'Lost the signal — still trying…' : 'No location yet — still trying…', true);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  };

  const start = (): void => {
    tracking = true;
    centered = false;
    setPressed(true);
    if (receiver?.connected) {
      say('Waiting for the receiver…');
    } else {
      say('Finding you…');
      startDevice();
    }
  };

  btn.addEventListener('click', () => {
    if (tracking) {
      // Off the screen: bring it back. On it: switch off.
      const ll = dot.getLatLng();
      if (map.hasLayer(dot) && !map.getBounds().contains(ll)) {
        map.panTo(ll);
        return;
      }
      stop();
      return;
    }
    start();
  });

  if (!receiverBtn || !receiverSupported()) return;
  receiverBtn.hidden = false;
  const label = (on: boolean): void => {
    receiverBtn.setAttribute('aria-pressed', String(on));
    receiverBtn.title = on ? 'Disconnect the GNSS receiver' : 'Connect a Bluetooth GNSS receiver, such as a Trimble R1';
  };
  label(false);
  const onReceiver = (state: ReceiverState): void => {
    switch (state.status) {
      case 'connecting':
        // From the first connection on, the raw lines can be looked at.
        if (log) log.hidden = false;
        say('Connecting to the receiver…');
        return;
      case 'waiting':
        label(true);
        if (!tracking) return;
        {
          const w = describeWaiting(state);
          say(w.text, w.warn);
        }
        return;
      case 'fix':
        label(true);
        fallback = '';
        if (!tracking) return;
        stopDevice();
        show(state.fix, `Receiver · ${describeFix(state.fix)}`);
        return;
      case 'lost':
      case 'off':
        label(false);
        // Back to the device's own location, and said plainly, on every fix
        // until the receiver is back: a dot that quietly changed source would
        // be trusted as if nothing had happened.
        fallback = state.status === 'lost' ? 'Receiver lost' : '';
        if (!tracking) return;
        startDevice();
        say(state.status === 'lost'
          ? `${state.message} Back to this device's own location.`
          : "Receiver disconnected. Back to this device's own location.", true);
        return;
    }
  };
  receiver = new Receiver(onReceiver);
  const log = document.getElementById('receiver-log') as HTMLDetailsElement | null;
  if (log) mountLog(log, receiver);
  receiverBtn.addEventListener('click', () => {
    if (receiver!.connected) {
      void receiver!.disconnect();
      return;
    }
    void receiver!.connect().then(() => {
      // Connecting a receiver means wanting to see where you are.
      if (receiver!.connected && !tracking) start();
      else if (receiver!.connected) { stopDevice(); say('Waiting for the receiver…'); }
    });
  });
}
