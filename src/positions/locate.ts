import L from 'leaflet';
import { accuracyLabel } from './accuracy';

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
 */

export interface Fix { lat: number; lng: number; accuracy: number }

export function initLocate(map: L.Map, btn: HTMLButtonElement): void {
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

  const setPressed = (on: boolean): void => {
    btn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Stop showing where I am (or bring the dot back on screen)' : 'Show where I am';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  };

  const stop = (): void => {
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    ring.remove();
    dot.remove();
    setPressed(false);
    say('');
  };

  const show = ({ lat, lng, accuracy }: Fix): void => {
    ring.setLatLng([lat, lng]).setRadius(accuracy).addTo(map);
    dot.setLatLng([lat, lng]).addTo(map);
    say(accuracyLabel(accuracy), accuracy > 15);
    // Center once, on the first fix. After that the map stays where the
    // surveyor puts it: it is in use, and a map that keeps jumping back to
    // the dot cannot be worked on.
    if (!centered) {
      centered = true;
      map.setView([lat, lng], Math.max(map.getZoom(), 19));
    }
  };

  btn.addEventListener('click', () => {
    if (watch !== null) {
      // Off the screen: bring it back. On it: switch off.
      const ll = dot.getLatLng();
      if (map.hasLayer(dot) && !map.getBounds().contains(ll)) {
        map.panTo(ll);
        return;
      }
      stop();
      return;
    }
    if (!navigator.geolocation) {
      say('This browser cannot share its location.', true);
      return;
    }
    centered = false;
    setPressed(true);
    say('Finding you…');
    watch = navigator.geolocation.watchPosition(
      (pos) => show({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
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
  });
}
