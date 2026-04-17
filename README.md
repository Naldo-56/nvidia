# RTX 5090 — Power Beyond Reality

Immersive single-product landing page for the NVIDIA GeForce RTX 5090.
Built as a standalone Node.js / Express project with a Three.js scroll-driven
3D scene, Lenis smooth scroll, and a gaming-HUD boot sequence.

## Stack

- **Runtime** — Node.js ≥ 18
- **Server** — zero-dependency Node stdlib (`http` + `fs`) — no `npm install` required
- **Frontend** — vanilla HTML / CSS / ES modules
- **3D** — Three.js (ES module via importmap + unpkg CDN)
- **Scroll** — [Lenis](https://github.com/darkroomengineering/lenis) + GSAP ScrollTrigger
- **Fonts** — Space Grotesk · Orbitron · JetBrains Mono (Google Fonts)

## Getting started

```bash
cd new
node server.js
```

…or via npm:

```bash
npm start
```

Then open <http://localhost:4173>.

### Dev mode (auto-reload on server changes)

```bash
npm run dev
```

Uses Node's built-in `--watch` flag.

### Environment variables

| Variable   | Default   | Purpose                                 |
| ---------- | --------- | --------------------------------------- |
| `PORT`     | `4173`    | HTTP port                               |
| `HOST`     | `0.0.0.0` | Bind address                            |
| `NODE_ENV` | –         | Set to `production` to enable 1h cache  |

## Structure

```
new/
├── server.js        # Express app + static serving + /healthz
├── package.json
├── index.html       # Landing page + intro boot overlay
├── styles.css       # Dark/light themes, HUD, intro, 3D stage
├── gpu.js           # Three.js procedural GPU + scroll-driven explode
├── app.js           # Lenis, dock, command bar, theme, intro sequencer
└── README.md
```

## Flow

1. **Boot intro** (`#intro`) — full-screen overlay with animated loader, boot
   sequence, and a pulsing `ENTER` button.
2. On detonate, a shockwave + flash fires and the Three.js GPU parts burst
   outward (via `window.__introExplode`), then collapse as the overlay fades.
3. **Scroll** is released; the GPU explodes/reassembles as the user scrolls
   through Architecture → Performance → Immersion → Buy.

## Endpoints

- `GET /` — landing page
- `GET /healthz` — JSON health probe (`{ ok, service, uptime }`)
- Unknown `GET` paths fall back to `index.html`

## Documentation

- **[docs/DEVELOPER.md](./docs/DEVELOPER.md)** — architecture, runtime
  timeline, 3D scene internals, intro sequencer, theming, extension recipes,
  and debugging notes. Read this before opening a PR.

## License

Concept showcase — placeholder content, not affiliated with NVIDIA Corporation.
