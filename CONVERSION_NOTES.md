# Conversion Notes — Sidereal Time and Hour Angle Demonstrator

## Behaviour model (one paragraph)

The sim shows a 3-D celestial sphere with the observer (a stick figure) standing
at the centre of a green horizon plane. Four sliders drive it: the observer's
**sidereal time** and **latitude** (Observer Properties), and a star's **right
ascension** and **declination** (Star Properties). The star can also be dragged
directly on the near side of the sphere. A white arc marks the star's RA measured
from the 0ʰ circle along the celestial equator; a red arc marks its declination;
the pale-yellow circles are the celestial equator and the 0ʰ hour circle; the blue
semicircle is the observer's meridian (its tilt tracks latitude), with blue stubs
at the celestial poles. The read-out **hour angle** = sidereal time − right
ascension (reduced to the range −12ʰ…+12ʰ) updates live, and a checkbox adds a
gold **hour angle arc** swept from the meridian to the star along its declination
parallel, with a gold label. Reset returns the view to azimuth 160°, altitude 35°,
latitude 41°, sidereal time 2ʰ, and the star to RA 4ʰ / dec 30°.

## Source → HTML5 mapping

| ActionScript source | HTML5 port (`simulation.js`) |
|---|---|
| `CelestialSphere.as`, `2 CS Getter Setter.as`, `3 CS Geometry.as` (doA/doM/doB, WtoSz/CtoSz/CtoW, StoMH/MHtoC) | `class CelestialSphere` — same matrices and projections, verbatim constants |
| `8 CS Circles.as` (`setParameters`, `doW`, `update` front/back split, `drawArc` tessellation) | `class Circle` — both horizon (sys 0) and celestial (sys 1) systems |
| `9 CS Lines.as` (segment split by sphere + horizon plane) | `class Line` — NCP/SCP pole stubs |
| `7 CS Objects.as` "absolute" orientation (oType 2) | `App.absOrient()` + `drawStick()` / `drawStar()` |
| `5 CS Horizon Plane.as` (`_xscale=r`, `_yscale=r·sin φ`) | `App.drawHorizonPlane()` — axis-aligned green ellipse |
| `6 CS Shading.as` + `CSGradientDisk.as` (masked bowl + edge shading) | `App.drawGlass()` — translucent radial body + rim (approximation; see below) |
| `Hour Angle Demo.as` (`init`, `setStarLocation`, `updateHourAngle`, `onLatitudeChanged`, `onSiderealTimeChanged`, `reset`) | `App` controller methods — logic ported line-for-line |
| `Draggable Star.as` (`onPress`/`onMouseMoveFunc`) | `App.onPointerDown/Drag` — front-facing star drags, else the sphere rotates |
| `toFixed.as` | `toFixedAS()` — identical round-half-up, zero-padded formatting |
| `Standard Slider v6.as` / `Slider Logic Class v6.as` (Flash component framework) | **not ported**; replaced by native `<input type=range>` + text field (same ranges/precision/change-handlers) |
| `Title Bar.as`, `Dialog Window v2.as`, About/Help sprites | replaced by the shared `<kl-unl-masthead>` component |

### Verbatim constants carried over
- Colours (decimal RGB): `raColor 16777215` (#FFFFFF), `decColor 16728128` (#FF4040),
  `hourAngleColor 16763749` (#FFCB65), pole axes / observer meridian `7711231`
  (#75A9FF), celestial equator + 0ʰ circle `16769909` (#FFE375).
- Angle factors: `D2R`, `R2D`, `H2R = 0.2617993877991494`, `R2H = 3.819718634205488`.
- Slider ranges/precision: sidereal time & RA `0…23.99` step `0.01`; latitude & dec
  `−90…90` step `0.1`. Reset seed: azimuth 160°, altitude 35°, lat 41°, ST 2ʰ,
  star RA 4ʰ / dec 30°. `minViewerAltitude = 7`.
- Hour angle: `((ST − RA + 24) mod 24)`, minus 24 if `> 12`; shown to 2 decimals.

## contents.json entry

`foundation/contents.json` is the shared masthead data file and **already contains**
the `siderealTimeAndHourAngleDemo` entry (meta.title "Sidereal Time and Hour Angle
Demonstrator", version 2.0, with Help and About text) — no new entry was added.

**Repair note (data-only):** the copy of `contents.json` shipped in this sim's
`foundation/` folder was **invalid JSON** — several entries contained raw newline
characters and unescaped `"` inside their HTML `content` strings, which made the
masthead's `fetch()`/`JSON.parse` fail for *every* sim, not just this one. The
copied file was repaired to valid JSON (raw control characters collapsed to
spaces; stray inner `"` escaped as `\"`) with **no change to any entry's meaning**;
all 107 sim entries — including this one — are preserved verbatim in content. This
is the single permitted content change to a foundation file; the `.js`/`.css`
foundation files are byte-for-byte unchanged.

## Deviations from the original (and why)

1. **Cyclic sliders → plain sliders.** The Flash sidereal-time and RA sliders wrap
   around (0 ↔ 24) when dragged past an end (`makeSliderCyclic`). Native
   `<input type=range>` cannot wrap, so these are ordinary clamped `0…23.99`
   sliders. The hour-angle maths already uses `mod 24`, so results are identical;
   only the extreme drag-past-the-end wrap gesture is gone. (Priority: accessible
   native controls over a Flash-only gesture.)
2. **Sphere shading is approximated.** The original composites masked gradient
   clips (`CSGradientDisk`, `sphere outside`/`sphere outside2`, `Sphere Edge
   Shading`) to shade the bowl and dim the far hemisphere. On the black field this
   is reproduced with a translucent radial fill + faint rim and a 55 % dimming of
   all far-side lines/labels — the same depth cue, drawn on the 2-D canvas. Circle
   and line **geometry** (the front/back split that decides what is occluded) is
   the exact AS computation, so nothing moves; only the shading texture differs.
3. **On-sphere text labels are HTML overlays, not canvas-baked.** The RA (white),
   dec (red) and hour-angle (gold) read-outs and the N/E/S/W direction labels are
   positioned HTML (percent coordinates over the scaled canvas) so they stay crisp
   and zoom with the page. See ACCESSIBILITY.md for the MathJax note on these.
4. **Assets reused as-is.** `star.png` / `star-hover.png` (Draggable Star frames 1
   and 2) and `stickfigure.png` (Stickfigure symbol) are the original exported
   bitmaps, copied unchanged into `assets/` and composited with `drawImage`. No art
   was redrawn. (`images/` in the export was empty; the star and figure live as
   bitmaps inside their sprites.)

## Cross-browser
Standards-only HTML/CSS/JS (Canvas 2-D, Pointer Events, `<input type=range>`,
CSS grid). MathJax uses SVG output with `fontCache:'local'` (no web-font fetch).
Verified rendering + interaction in the Chromium preview; no Chrome-only APIs or
prefix-only CSS are used, so Firefox and Safari (desktop + iOS) behave the same.
