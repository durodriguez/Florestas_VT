# A GNSS receiver on a laptop

Both field tools, the Tree Survey app (`/field/`) and the positions tool
(`/positions/`), can take their position from a Bluetooth GNSS receiver such
as the Trimble R1, instead of from the device they run on.

**On an Android phone** nothing in the apps is involved. Trimble Mobile Manager
connects to the receiver and puts its position in place of the phone's own
(Android's "mock location"), and the apps read it as the phone's location.

**On a Windows laptop** there is no such app, so the page reads the receiver
itself, through Chrome's Web Serial API. That needs **Chrome or Edge**; in
other browsers the button does not appear.

## Using it

1. **Pair the receiver with Windows**, once: Settings → Bluetooth & devices →
   Add device. Windows gives it a serial ("COM") port; under More Bluetooth
   settings → COM Ports you can see it.
2. Turn the receiver on, and open the app in Chrome or Edge.
3. **Positions tool:** **Receiver** in the header. **Survey app:** **Connect
   receiver**, under the map. Chrome lists the ports it can see; choose the
   receiver's.
4. A line says what the position is based on, for example
   *Receiver · SBAS · 19 satellites · ±1.3 m*. In the positions tool the blue
   dot and its circle follow the receiver; in the survey app the pin, the
   accuracy and the "GPS ±… m" note saved with a new tree do.
5. Press the same button again to disconnect. Chrome asks for the port again
   each time the page is opened.

If the receiver drops (switched off, out of range, battery), the apps go back
to the laptop's own location and say so: the positions tool marks every
position after that *Receiver lost* until the receiver is back.

## What the numbers mean

- **Fix type.** *SBAS* is the free correction broadcast by satellite (WAAS in
  the US), applied by the receiver itself. It is what Trimble Mobile Manager
  showed on the phone in November 2026, so a laptop connection loses nothing.
  *Autonomous* is no correction at all; *RTK fixed* and *float* would need a
  correction service the laptop does not have.
- **Accuracy** is the receiver's own estimate, from its GST sentence: the same
  figure Trimble Mobile Manager shows as *Horizontal precision (RMS)*. Mobile
  Manager's home screen shows a larger, more cautious *Horizontal accuracy*
  for the same fix. If the receiver does not send GST, the apps estimate the
  accuracy from its HDOP instead and mark it *(estimated)*.

## If it does not work

- **"Nothing is arriving from it."** Connected, but no NMEA sentences in five
  seconds: the receiver is not sending positions on that port. The R1 may need
  NMEA output (GGA, and GST for its accuracy) switched on for its Bluetooth
  port, in Trimble Mobile Manager or the older GNSS Status app.
- **"No position from it yet."** Sentences arrive, but without a fix: the
  receiver is still acquiring satellites. Move into the open and wait.
- **The receiver is not in Chrome's list.** Check that it is paired in Windows
  and switched on.

## Not yet checked

This was written and tested against simulated receiver output, not a real R1,
on 6 November 2026. Two things are open until it is tried in the field:

- whether the R1 sends GGA and GST to a laptop without being told to;
- **which datum** it sends them in. Mobile Manager reported NAD83(2011) on the
  phone; the imagery and the map are WGS84, and in Vermont the two differ by
  roughly a meter. Checking a laptop position against a known point would
  settle it.

The code is `src/gnss/` (`nmea.ts` reads the sentences, `receiver.ts` holds
the connection), with tests in `tests/gnss.test.ts`.
