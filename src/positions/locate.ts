import L from 'leaflet';
import { accuracyLabel } from './accuracy';

/**
 * "You are here" for checking positions in the field: a blue dot that follows
 * the device, inside a shaded circle the size of the accuracy the device
 * reports. The circle is the point. Phone GPS is commonly off by 3–10 m, the
 * same size as the corrections this tool makes, so a dot on its own would
 * invite moving trees to where the phone *thinks* it is.
 *
 * Neither shape takes the pointer: trees under them stay draggable.
 */

export interface Fix { lat: number; lng: number; accuracy: number }

export function initLocate(map: L.Map): void {
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

  let watch: number | null = null;
  let centered = false;

  const Control = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create('div', 'leaflet-bar locate-control');
      const btn = L.DomUtil.create('a', 'locate-btn', box) as HTMLAnchorElement;
      btn.href = '#';
      btn.setAttribute('role', 'button');
      btn.title = 'Show where I am';
      btn.setAttribute('aria-label', 'Show where I am');
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = '◎';
      const msg = L.DomUtil.create('span', 'locate-msg', box);
      msg.setAttribute('role', 'status');
      L.DomEvent.disableClickPropagation(box);

      const say = (text: string, warn = false): void => {
        msg.textContent = text;
        msg.classList.toggle('is-warn', warn);
      };

      const stop = (): void => {
        if (watch !== null) navigator.geolocation.clearWatch(watch);
        watch = null;
        ring.remove();
        dot.remove();
        btn.setAttribute('aria-pressed', 'false');
        btn.title = 'Show where I am';
        say('');
      };

      const show = ({ lat, lng, accuracy }: Fix): void => {
        ring.setLatLng([lat, lng]).setRadius(accuracy).addTo(map);
        dot.setLatLng([lat, lng]).addTo(map);
        say(accuracyLabel(accuracy), accuracy > 15);
        // Center once, on the first fix. After that the map stays where the
        // surveyor puts it: it is in use, and a map that keeps jumping back
        // to the dot cannot be worked on.
        if (!centered) {
          centered = true;
          map.setView([lat, lng], Math.max(map.getZoom(), 19));
        }
      };

      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.preventDefault(e);
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
        btn.setAttribute('aria-pressed', 'true');
        btn.title = 'Stop showing where I am (or bring the dot back on screen)';
        say('Finding you…');
        watch = navigator.geolocation.watchPosition(
          (pos) => show({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          (err) => {
            // Only a refusal ends it. A timeout or a dropped signal is
            // normal walking among buildings, and the watch keeps going.
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
      return box;
    },
  });
  new Control({ position: 'topleft' }).addTo(map);
}
