# Accessibility Notes — Sidereal Time and Hour Angle Demonstrator

Target: WCAG 2.1 AA (AAA where reasonable). Built on the KL-UNL foundation, whose
CSS/JS provide the palette, focus-visible ring, responsive grid, and the masthead
dialog (which manages its own focus trap + Escape).

## Structure & landmarks
- One `<h1>` — the sim title — is rendered by `<kl-unl-masthead>`; the sim adds
  only `<h2>` panel headings ("The Celestial Sphere", "Observer Properties",
  "Star Properties"). No competing `h1`.
- `<main>` landmark; each panel is a labelled `<section>`; controls are grouped in
  `<fieldset>`/`<legend>`. A "Skip to controls" link is the first focusable item.
- `<html lang="en">`.

## Keyboard
- Every control is a native element in a logical tab order with the foundation's
  visible focus ring.
- **Sliders** are native `<input type=range>` — Left/Down decrement, Right/Up
  increment, Page keys larger steps, Home/End min/max, all for free. Each carries
  an `aria-valuetext` with the quantity name **and unit** (see below). Tab always
  moves away cleanly; the canvas pointer handlers never steal focus from them.
- The **diagram** is focusable (`tabindex=0`): arrow keys rotate the view
  (Shift = finer, Page keys change altitude in 15° steps).
- A visually-transparent **star handle** button sits over the star and stays in
  the tab order: its arrow keys move the star (Left/Right = right ascension,
  Up/Down = declination; Shift finer; Page keys move declination by 15°). Both the
  drag and the keyboard path mutate the same state as the sliders.

## Units are always spoken with numbers (supervisor requirement)
Screen readers announce only the accessible name/value, so every numeric value is
paired with its quantity **and unit** in an `aria-valuetext` / `aria-label` /
`.sr-only` companion — never a bare number:
- sliders → e.g. "Right ascension 4.00 hours", "Declination 30.0 degrees",
  "Latitude minus 20.0 degrees", "Sidereal time 6.00 hours";
- the star handle → "Star position. Right ascension 4.00 hours, declination 30.0
  degrees.";
- the hour-angle read-out → spoken "Hour angle minus 2.00 hours." (`#haEqnSr`);
- negative values are spoken as the word **"minus"** (a leading "−" glyph is
  routinely dropped).

## Live region & diagram description
- `#diagramDesc` is an `aria-live="polite"` region that announces meaningful state
  changes **on commit** (slider `change`, drag end, checkbox, reset) — not on every
  drag tick — always with units and context (star position, hour angle, latitude,
  sidereal time, view rotation).
- The `<canvas>`'s `aria-label` is kept updated with a full, units-complete
  description of what the diagram currently shows (observer latitude, sidereal
  time, star RA/dec, hour angle), so an audio-only user gets the same "what's on
  screen" a sighted user sees. Both were sanity-checked against NVDA (Windows) and
  VoiceOver (macOS) wording.

## Equations, symbols and units (no MathJax)
This sim uses **no MathJax** (it was removed — see CONVERSION_NOTES). The content
here is text/units, not real math notation, so plain accessible HTML is used and
every unit is spoken by the control that owns it:
- The slider unit symbols beside the number boxes (ʰ via `<sup>h</sup>`, ° via the
  degree glyph) are decorative (`aria-hidden`); the spoken unit comes from each
  input's `aria-label` ("Sidereal time, hours", "Latitude, degrees", …) and each
  slider's `aria-valuetext` ("Right ascension 4.00 hours", "Declination 30.0
  degrees", …), so no value is ever announced as a bare number.
- The live **hour angle: −2.00 h** read-out is plain HTML, with a `.sr-only`
  units-complete spoken companion ("Hour angle minus 2.00 hours.").
- The defining relation **Hour Angle = Sidereal Time − Right Ascension** is plain
  italic HTML text, read directly by screen readers.
- The read-out labels that ride on the rotating sphere — RA (white), dec (red),
  hour angle (gold) — and the N/E/S/W direction labels are plain HTML overlays
  using Unicode "h"/"°"; the authoritative values with full spoken units live in
  the control panel and the live diagram description.

## Colour & contrast
- Palette comes from the KL-UNL CSS custom properties. State is never encoded by
  colour alone: the RA/dec/hour-angle arcs each carry a text label with their
  numeric value and unit, and every control has a real text label.
- On-canvas overlay labels use a dark text-halo so white/red/gold text stays
  legible (≥ 3:1) over both the green horizon plane and the black field. The `dec`
  label colour is lightened from the original #FF4040 to #FF6A6A so its text keeps
  ≥ 4.5:1 against the dark backdrop; the physically-meaningful red hue is retained.

## Motion
- The sim has **no autonomous motion** (nothing animates on its own; everything is
  user-driven), so there is nothing to pause and no flashing. `prefers-reduced-
  motion` is honoured (transitions forced instant). Reset is provided by the
  masthead's `sim-reset` event — no second Reset button is added.

## Responsive / zoom
- Body text ≥ 1.125rem, sized in rem/em; layout reflows from desktop → iPad →
  phone portrait (single stacked column at the foundation's 56rem breakpoint) with
  no horizontal scrolling and no clipping at 200 % zoom. The canvas keeps its
  original internal coordinates and is scaled by CSS (aspect-ratio preserved);
  pointer coordinates are mapped back through the live display scale so drag +
  hit-testing stay exact at any size.

## Remaining QA
Automated/most manual checks pass in the Chromium preview. **Human screen-reader QA
is still required** — a real pass with NVDA (Windows, Chrome + Firefox) and
VoiceOver (macOS + iOS Safari) should confirm announcement order, that units are
spoken everywhere, and that dragging/keyboard on the diagram are followable by an
audio-only user.
