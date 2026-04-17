# RTX 5090 — Developer Documentation

Deep dive into the RTX 5090 immersive landing page for contributors and
maintainers. If you only need to run the project, see the [README](../README.md).

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [File map](#2-file-map)
3. [Runtime timeline](#3-runtime-timeline)
4. [Server (`server.js`)](#4-server-serverjs)
5. [Smooth scroll — Lenis (`app.js`)](#5-smooth-scroll--lenis-appjs)
6. [3D scene — Three.js (`gpu.js`)](#6-3d-scene--threejs-gpujs)
7. [Intro / boot sequence](#7-intro--boot-sequence)
8. [HUD widgets — chips, dock, command bar](#8-hud-widgets--chips-dock-command-bar)
9. [Theming (dark ⇄ light)](#9-theming-dark--light)
10. [Global `window` API](#10-global-window-api)
11. [Extending the site — recipes](#11-extending-the-site--recipes)
12. [Performance notes](#12-performance-notes)
13. [Debugging & gotchas](#13-debugging--gotchas)
14. [Conventions](#14-conventions)

---

## 1. Architecture overview

The project is a single-page, scroll-driven product page. There is **no build
step** — `index.html` loads CSS, Three.js (ES module via importmap), Lenis, and
GSAP directly from CDN. A tiny zero-dependency Node server streams the static
files.

```
┌───────────────────┐    GET /…    ┌─────────────────────────┐
│  Browser client   │ ◄──────────  │  server.js (http + fs)  │
└────────┬──────────┘              └─────────────────────────┘
         │ executes
         ▼
┌──────────────────────────────────────────────────────────────┐
│  index.html — boot overlay + main DOM                        │
├──────────────────────────────────────────────────────────────┤
│  styles.css — tokens, HUD, intro, 3D stage, themes           │
├──────────────────────────────────────────────────────────────┤
│  gpu.js  — Three.js scene, drives off window.__scroll        │
│  app.js  — Lenis, intro sequencer, dock, theme, progress bar │
└──────────────────────────────────────────────────────────────┘
```

The two client-side scripts are **decoupled via `window`-level globals**
(see §10), so `gpu.js` only reads scroll state and knows nothing about DOM
events.

---

## 2. File map

```
new/
├── server.js          # Node stdlib HTTP server
├── package.json       # name, scripts, engines
├── index.html         # markup: intro overlay + main + libs
├── styles.css         # design tokens, HUD, intro, themes
├── gpu.js             # Three.js — procedural GPU + scroll driver
├── app.js             # Lenis, dock, command bar, theme, intro
├── README.md          # user-facing quickstart
├── .gitignore
└── docs/
    └── DEVELOPER.md   # ← you are here
```

---

## 3. Runtime timeline

```
t=0      page load
         │  CSS parsed, fonts swap in
         │  #intro overlay is visible (z-500), scroll is LOCKED
         │
t=0.05s  Lenis initialized → lenis.stop()
         Three.js scene mounted behind the overlay (alpha canvas)
         boot() starts its setInterval loop (~55 ms tick)
         │
t=~3.5s  boot progress hits 100% → "READY TO DETONATE"
         #introEnter button becomes .is-ready (pulse animation)
         User can Enter / click / Space to continue
         │
t=click  detonate() fires:
         ├─ intro__shock + intro__flash trigger (CSS keyframes)
         ├─ window.__introExplode ramps 0 → 1 over 700 ms (easeOutQuart)
         │  gpu.js reads this and bursts all assembly parts outward
         ├─ +520 ms → #intro gets .is-gone (blur + scale + opacity fade)
         └─ +1300 ms → lenis.start(), #intro removed from DOM
                       window.__introExplode collapses 1 → 0 over 900 ms
                       (GPU reassembles into hero pose)
         │
t=post   Normal browsing:
         Scroll progress (0..1) → window.__scroll → gpu.js
         gpu.js runs explode curve piecewise based on scroll position
         dock__btn.is-active follows sections via IntersectionObserver
         XP bar, theme toggle, and parallax glows update per frame
```

---

## 4. Server (`server.js`)

Zero-dependency Node `http` server. Key design decisions:

- **Safe resolve** — every URL path is `decodeURIComponent` + `path.normalize`
  + `startsWith(ROOT)` guarded, so `../../etc/passwd`-style traversals return
  `403 Forbidden`.
- **ETag/304** — `W/"<size>-<mtime>"` is compared against `If-None-Match` to
  short-circuit unchanged files.
- **Cache policy** — HTML always `no-cache` so intro/version bumps land
  instantly; other assets get `public, max-age=3600` when
  `NODE_ENV=production`.
- **SPA fallback** — extension-less paths fall back to `index.html`.
- **Security headers** — `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: SAMEORIGIN` on every response.
- **Graceful shutdown** — `SIGINT`/`SIGTERM` trigger `server.close()`.
- **Colored access log** — `${status} ${method} ${url} ${ms}` with ANSI
  coloring by status class.

### Environment variables

| Var        | Default   | Use                                |
| ---------- | --------- | ---------------------------------- |
| `PORT`     | `4173`    | TCP port                           |
| `HOST`     | `0.0.0.0` | Bind address                       |
| `NODE_ENV` | –         | `production` enables 1h asset cache |

### Endpoints

| Path            | Behavior                                          |
| --------------- | ------------------------------------------------- |
| `GET /`         | Serves `index.html`                               |
| `GET /healthz`  | JSON `{ ok, service, uptime, node }`              |
| `GET /<file>`   | Static file with ETag + MIME                      |
| `GET /<deep>`   | Unknown extension-less path → `index.html`        |
| Other methods   | `405 Method Not Allowed` + `Allow: GET, HEAD`     |

---

## 5. Smooth scroll — Lenis (`app.js`)

Single Lenis instance with `lerp: 0.08`. Because GSAP's ScrollTrigger ticker
drives Lenis' raf loop, we do **not** pass `autoRaf: true`:

```js
gsap.registerPlugin(ScrollTrigger);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

`lenis.on("scroll")` is the source of truth for `window.__scroll` (a number
0..1 used by `gpu.js`). A native `window.scroll` listener is attached as a
belt-and-suspenders fallback for browsers that miss the Lenis event on the
first paint.

### Anchor scrolling

```js
new Lenis({ anchors: { offset: -60 } });
```

Anchor links like `href="#buy"` scroll smoothly to the target with a -60px
offset. Programmatic scrolling uses `lenis.scrollTo(target, { offset, duration })`.

---

## 6. 3D scene — Three.js (`gpu.js`)

The GPU is built procedurally from Three.js primitives (no GLTF loader
needed). Root group is `gpu`, parented to `scene`. Lights: 1 ambient +
1 directional key + 3 point lights (neon, cyan, magenta).

### The `assembly[]` pattern

Every top-level part registers in an array with a starting position and a
"blown-out" offset vector:

```js
const assembly = [
  { node: shroud,   out: new THREE.Vector3(0, 2.4, 0) },
  { node: finGroup, out: new THREE.Vector3(0, 1.2, 0) },
  { node: fans,     out: new THREE.Vector3(0, 3.0, 0) },
  { node: pcb,      out: new THREE.Vector3(0, -1.8, 0) },
  // … etc.
];
assembly.forEach(a => { a.origin = a.node.position.clone(); });
```

In the render loop:

```js
const ex = Math.max(explode /* from scroll */, window.__introExplode || 0);
assembly.forEach(a => {
  a.node.position.set(
    a.origin.x + a.out.x * ex,
    a.origin.y + a.out.y * ex,
    a.origin.z + a.out.z * ex,
  );
});
```

**VRAM chips** and **heat-sink fins** are handled separately because their
dispersion is directional:

- VRAM pushes along the sign of its own X/Z (fan-out on the PCB plane)
- Fins spread along Z by scaling `o.z * (1 + ex * 1.8)`

### Explode curve

`updateFromScroll(p)` computes `explode` piecewise:

| Scroll `t`      | `explode`                              | Phase                 |
| --------------- | -------------------------------------- | --------------------- |
| `0.00 – 0.20`   | `0`                                    | Hero — assembled      |
| `0.20 – 0.45`   | `easeInOut((t-0.20)/0.25)`             | Burst outward         |
| `0.45 – 0.70`   | `1`                                    | Fully exploded        |
| `0.70 – 0.85`   | `1 - ease … × 0.4`                     | Pull closer (wireframe) |
| `0.85 – 1.00`   | `(1 - ease) × 0.6 → 0`                 | Reassemble for Buy    |

The final value is `Math.max(explode, window.__introExplode || 0)` so the
intro detonation can drive the same offsets even when the user hasn't
scrolled yet.

### Other driven parameters

| Effect                         | Driver                                 |
| ------------------------------ | -------------------------------------- |
| Root rotation (Y)              | `t × 1.4π + time × 0.00015`            |
| Camera dolly                   | `z = 8 - sin(t·π) × 2.5`               |
| Horizontal shift (per section) | `getViewShift(t)` piecewise LUT        |
| Ring opacity                   | `base + explode × k`                   |
| Die emission                   | pulses + spikes at AI-section (`t≈0.30`) |
| Rim-cyan intensity             | spikes at Cooling section (`t≈0.55`)  |
| Fan RPM                        | `0.02 + explode × 0.08 + cool × 0.12`  |

### Particle field

380 points on a `BufferGeometry`, additive blending, Y drifts upward each
frame and wraps when `y > 4`.

### Wireframe overlay

A `LineSegments(EdgesGeometry(BoxGeometry))` overlay fades in between scroll
`0.60 – 0.80` for the "architecture" step, then fades back out.

---

## 7. Intro / boot sequence

Owned by `boot()` inside `app.js`.

1. `lenis.stop()` + `document.documentElement.style.overflow = "hidden"` —
   no scrolling until user commits.
2. A `setInterval(..., 55ms)` increments `p` by `1.4 + rand(1.6)` and updates
   `#introFill`, `#introPct`, `#introStatus` (text cycles through 6 phases).
3. When `p >= 100` the interval clears and `#introEnter` gains `.is-ready`
   (unlocks pointer events and starts a breathing shadow animation).
4. `detonate()` fires on click or Enter/Space:
   - `#introShock` and `#introFlash` get `.is-boom` → pure-CSS animations
   - `window.__introExplode` ramps **0 → 1** via rAF over 700 ms
     (easeOutQuart) — that's what makes the Three.js GPU actually explode
   - at +520 ms: `#intro.is-gone` (opacity + blur + scale-up 1.08)
   - at +1300 ms: Lenis released, overlay removed from the DOM, and
     `__introExplode` collapses **1 → 0** over 900 ms — the GPU reassembles
     into the hero pose

### CSS entry points

| Class                       | Target                     | Effect                        |
| --------------------------- | -------------------------- | ----------------------------- |
| `.intro__row`               | boot rows                  | staggered fade-in per child   |
| `.intro__shock.is-boom`     | shockwave ring             | `scale(0) → scale(240)`       |
| `.intro__flash.is-boom`     | radial flash               | white → neon → fade           |
| `.intro__enter.is-ready`    | ENTER button               | `readyBreathe` pulse          |
| `.intro.is-gone`            | overlay                    | blur + scale-up + fade        |

---

## 8. HUD widgets — chips, dock, command bar

### Chips

- `.chip--logo` (top-left) and `.chip--status` (top-right) — pill-shaped,
  `backdrop-filter: blur(14px) saturate(1.35)`.
- Status chip has a live `#clk` that `tick()` updates every 20 s.

### Right-rail dock

- `<a class="dock__btn" data-id="architecture">` per section. Clicking calls
  `lenis.scrollTo(el, { offset: -40, duration: 1.4 })`.
- Collapsed by default (`max-width: 38px`), expands on `.dock:hover` to
  reveal labels (`max-width: 200px`).
- Active section is tracked with **IntersectionObserver** using
  `rootMargin: "-45% 0px -45% 0px"` so the highlight flips near the viewport
  center.

```js
const dockIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      dockTargets.forEach(o =>
        o.btn.classList.toggle("is-active", o.el === e.target)
      );
    }
  });
}, { rootMargin: "-45% 0px -45% 0px" });
```

### Bottom command bar

Contains: scroll-to-top, next-section, FX toggle, theme toggle, buy CTA.
`next` uses the current active dock index to pick the following target.

The **FX toggle** flips `body.fx-off`, which dampens ambient glows, grid
opacity, and disables the XP bar's scan animation.

---

## 9. Theming (dark ⇄ light)

Dark is the default. Light is triggered by `body.theme-light` and overrides
the `:root` custom properties to lighter values + applies a few specific
card/background rules.

```css
body.theme-light {
  --bg: #eef1e9;
  --ink: #0b0e0a;
  --neon: #4fc200;       /* darker green for contrast on light bg */
  background: radial-gradient(...); /* custom layered gradient */
}
```

Client persistence:

```js
localStorage.setItem("rtx-theme", isLight ? "light" : "dark");
```

The Three.js scene **also reacts** to theme via `window.__gpuTheme(isLight)`,
which:

- Adjusts `scene.fog` color
- Re-tints the particle material and orbital rings
- Boosts ambient light intensity (`0.55 → 0.9`) so dark PCB/shroud materials
  don't look muddy against a bright page

Icons swap automatically (`.ico-sun` vs `.ico-moon` have `display: none`
rules guarded by `body.theme-light`).

---

## 10. Global `window` API

The two client scripts talk via a handful of globals. Treat these as the
public contract between modules.

| Global                    | Set by     | Read by                  | Type             | Purpose                                    |
| ------------------------- | ---------- | ------------------------ | ---------------- | ------------------------------------------ |
| `window.__scroll`         | `app.js`   | `gpu.js`                 | `number` 0..1    | Normalized scroll progress                 |
| `window.__introExplode`   | `app.js`   | `gpu.js`                 | `number` 0..1    | Intro-driven explode factor                |
| `window.__gpuResize`      | `gpu.js`   | `app.js`                 | `() => void`     | Re-sizes the renderer on window resize     |
| `window.__gpuTheme`       | `gpu.js`   | `app.js`                 | `(bool) => void` | Recolor scene for dark/light theme         |
| `window.__fxOff`          | `app.js`   | (reserved)               | `boolean`        | FX toggle state — hook for future effects  |
| `window.__themeLight`     | `app.js`   | (reserved)               | `boolean`        | Current theme — hook for future effects    |

---

## 11. Extending the site — recipes

### Add a new content section

1. Add `<section class="feature section" id="my-section">…</section>` in
   `index.html`. Mirror the existing `.feature` markup (meta + body).
2. Append a dock entry:
   ```html
   <a class="dock__btn" href="#my-section" data-id="my-section">
     <span class="dock__idx">05</span>
     <span class="dock__lbl">My Section</span>
     <span class="dock__dot"></span>
   </a>
   ```
3. Optionally nudge the explode curve in `gpu.js → updateFromScroll()` so
   the GPU behaves how you want across the new scroll range.

### Add a new 3D part

Register it in the `assembly` array to make it participate in the
explode/reassemble animation:

```js
const myPart = new THREE.Mesh(geo, mat);
gpu.add(myPart);
assembly.push({
  node: myPart,
  origin: myPart.position.clone(),
  out: new THREE.Vector3(0, 2, 0),   // lifts 2 units up on full explode
});
```

If the part needs per-child motion (like VRAM), store origins on each child
in `userData.origin` and handle it in its own loop.

### Add a new theme

1. Duplicate the `body.theme-light` block in `styles.css`, e.g.
   `body.theme-synthwave`, and override the tokens you want.
2. In `app.js`, cycle classes on toggle or add a dropdown. Persist via
   `localStorage`.
3. Call `window.__gpuTheme(someFlag)` if the 3D needs to respond.

### Change the intro text / steps

- Boot phrases live in the `steps[]` array inside `boot()` in `app.js`.
- The 6 boot rows live in `#intro .intro__boot` in `index.html` — keep the
  animation-delay stagger consistent (`nth-child(n)` selectors are in
  `styles.css`).

---

## 12. Performance notes

- **Pixel ratio** is capped: `renderer.setPixelRatio(Math.min(dpr, 2))` to
  avoid 4k-retina meltdowns.
- **Shadows are off** — lighting is entirely emissive + ambient; gains 20-40
  FPS on mid-tier laptops.
- **Particle `Points`** use `AdditiveBlending + depthWrite: false` so they
  don't z-fight the GPU and render in a single draw call.
- **Lenis lerp** is `0.08` — higher values (snappier) cost more DOM reads on
  every rAF; lower values feel smooth but float-y.
- **rAF loops are split** — GSAP's ticker drives both Lenis' raf AND
  anything GSAP-animated, so there's a single heartbeat.
- **Intersection observers** replace `scroll` listeners for dock/stat
  counters so they don't block the main thread.

Rule of thumb: anything that reads `gpu.rotation`, `camera.position`, or
modifies materials belongs in `updateFromScroll()`. Anything DOM-level
belongs in `app.js`'s rAF or IO callbacks. Don't cross the streams.

---

## 13. Debugging & gotchas

### "I edited CSS/JS but the browser still shows the old version"

Assets use query-string versioning in `index.html`:

```html
<link rel="stylesheet" href="./styles.css?v=6" />
<script type="module" src="./gpu.js?v=6"></script>
<script src="./app.js?v=6"></script>
```

Bump the `v=N` suffix whenever you ship a breaking frontend change. The
server itself sends `Cache-Control: no-cache` on HTML, so the new query
string is always requested immediately.

### "The GPU never appears"

- Open devtools → Console. If Three.js failed to load, check the
  `importmap` and the unpkg CDN.
- Run `window.__scroll` in the console — it should update when you scroll.
  If it stays at `0`, the Lenis scroll event isn't firing. Try reloading;
  sometimes the first-paint race lets the native `scroll` fallback take over.

### "The intro never disappears"

- `lenis.start()` is called in `detonate()` at +1300 ms. If you paused the
  boot loader (breakpoint) past the grace window, the `removeChild` might
  throw. It's wrapped in try/catch, but scroll will remain locked. Run
  `lenis.start(); document.getElementById('intro')?.remove()` in the console
  to recover.

### "Theme doesn't apply to the Three.js canvas"

`window.__gpuTheme(true/false)` is called by the toggle. The canvas is
`alpha: true`, so the body background shows through; make sure
`scene.fog.color` matches, otherwise parts at the fog plane will look
oddly tinted.

### Reduced motion

`@media (prefers-reduced-motion: reduce)` zeroes animation and transition
durations globally. The rAF loops still run — if you want to truly freeze
the scene, branch on
`window.matchMedia("(prefers-reduced-motion: reduce)").matches` in
`updateFromScroll` and early-return after a one-time pose.

### Cache-busting on the Node server

The Node server never emits hashed filenames — it relies on the HTML query
strings. If you deploy behind a CDN, set
`NODE_ENV=production` so asset `Cache-Control: public, max-age=3600`
kicks in, and let the `v=` suffix break caches on release.

---

## 14. Conventions

- **Plain JS only** — no TypeScript, no bundler. Keep it viewable with
  View-Source.
- **Vanilla Three.js** — no helpers (no OrbitControls, no GLTFLoader). If
  you need them, import from the `three/examples/jsm/...` CDN, not a new
  build tool.
- **CSS custom properties** live on `:root`; theme overrides live on
  `body.theme-*`.
- **`const` + IIFEs** — `app.js` wraps its logic in an IIFE to avoid
  polluting globals; shared state lives on `window.__*`.
- **No frameworks** — intentionally. If you reach for React, that's a
  different project.
- **Sections are full-viewport** (`min-height: 100vh`) — explode timing in
  `updateFromScroll` assumes ~7-8 sections of that height. Adjust the
  piecewise thresholds if you change the page length significantly.
