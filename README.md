# Sidereal Time and Hour Angle Demonstrator (HTML5)

An accessible HTML5 rebuild of the Flash *Sidereal Time and Hour Angle
Demonstrator*, built on the shared KL-UNL foundation.

## It must be served over HTTP — double-clicking `index.html` will NOT work

**Why:** the KL-UNL masthead (`foundation/kl-unl-masthead.js`) loads its title,
Help, and About text with `fetch('foundation/contents.json')`. Browsers block
`fetch()` of local files under the `file://` protocol (same-origin policy), so
opening the file directly leaves the masthead empty/broken. Served over HTTP the
fetch succeeds and the sim loads normally.

## How to run locally

Run one of these **from inside this `html5/` folder**, then open the printed URL:

```
Python:   python3 -m http.server 8123      then open  http://localhost:8123/
Node:     npx serve                         (or:  npx http-server)
VS Code:  the "Live Server" extension
```

When you serve from inside `html5/`, the sim is at the server root, so the URL is
`http://localhost:8123/` — not `.../html5/index.html`.

## Production

When deployed to the cloud host (served over HTTP/HTTPS) it just works; the
`file://` limitation only affects local double-clicking.

## Layout

```
html5/
  index.html          KL-UNL scaffold: masthead + panels
  foundation/         copied UNCHANGED from the linked sim's foundation/
                        (kl-unl-masthead.js, kl-unl.css, kl-unl.js, contents.json)
  styles/styles.css   sim-specific styles only
  simulation.js       all sim logic (engine port + controller + rendering)
  assets/             reused exported art (star.png, star-hover.png, stickfigure.png)
  .nojekyll           tells GitHub Pages to serve files as-is (skip Jekyll)
  README.md           this file
  CONVERSION_NOTES.md AS -> HTML5 mapping and behaviour notes
  ACCESSIBILITY.md    WCAG affordances and remaining QA notes
```

No build step, no bundler, no CDN, no external libraries. The only runtime fetch
is local (`foundation/contents.json`).

## Hosting on GitHub Pages

Deploy this `html5/` folder as the site root (its `index.html` is the entry
point). The included empty `.nojekyll` file tells GitHub Pages to publish the
files as-is instead of running them through Jekyll — without it, Jekyll's build
step can fail on third-party JavaScript, which is what produces the generic
"Deployment failed, try again later" error. Keep `.nojekyll` at the site root.
