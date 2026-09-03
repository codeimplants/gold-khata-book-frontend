# TODO — verify the photo picker on iOS hardware

**Status: fixed in shared code, unverified on iOS.** Android was verified on a real
device; iOS has not been run since the change.

Delete this file once the checks below pass on an iPhone.

---

## What was wrong, and why iOS was affected too

On Android, tapping **+ Add Photo → camera**, taking a photo and confirming it did not
return to the form — the camera reopened, and kept reopening until the user pressed the
X. Reported from a real device on 2026-08-17.

The cause was not the native picker. `react-native-image-picker`'s `launchCamera` fires a
single `startActivityForResult` and never reads `selectionLimit`. The relaunch came from
the app: `components/photos/PhotoField.tsx` wrapped the picker in a `do…while` that
reopened the camera until the photo cap was reached, deliberately, so that filling a
six-photo ornament field cost one trip instead of six. Its only exits were *cancel* and
*cap reached*, so confirming a shot looked like the app had refused it.

The guard was `Platform.OS !== 'web'`, so **iOS looped identically** — tapping "Use Photo"
would reopen the camera the same way. There is no platform branch anywhere in this path:
one JS fix covers both, which is why there is no separate iOS change to make. What iOS
needs is confirmation on hardware, and the reason it needs that is that the Simulator
has no camera worth trusting for this.

The loop is gone. One tap of + Add Photo is now one photo, camera and gallery alike.

## What to check on a real iPhone

Old gold declaration (or any screen with a multi-photo field):

- [ ] + Add Photo → **Camera** → shoot → **Use Photo** returns straight to the form,
      with the photo attached
- [ ] The camera does **not** reopen by itself afterwards
- [ ] **Retake** inside the camera still works and does not double-add
- [ ] Tapping + Add Photo repeatedly fills a six-photo field to the cap, then shows the
      "up to {count} photos" message rather than opening the camera again
- [ ] + Add Photo → **Photo Library** → a multi-selection still arrives in one go
      (the library path was never looped and must not have regressed)
- [ ] Cancelling out of the camera leaves any previously added photos untouched
- [ ] Single-photo fields (customer photo, `CustomerPhotoPicker`) are unchanged — they
      always passed `limit: 1` and never looped

## Related

`NSCameraUsageDescription` must stay in Info.plist for as long as any `launchCamera`
caller exists — removing it crashes the app on tap with no JS error. See CLAUDE.md,
"Permissions — an iOS crash, not a warning".
