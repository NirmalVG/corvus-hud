<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# AGENTS.md — IronMan HUD

> Instructions for AI coding agents (Claude Code, Cursor, Copilot, etc.)
> working inside this repository. Read this before touching any file.

---

## Project Overview

**IronMan HUD** is a mobile web AR application built with Next.js 14 (App Router).
It overlays real-time object detection, GPS, weather, and environmental data on the
phone camera feed — replicating Iron Man's helmet HUD. All ML inference runs
client-side via TensorFlow.js. There is no backend except optional Vercel Serverless
Functions for logging.

---

## Tech Stack (Do Not Substitute)

| Layer            | Technology          | Version |
| ---------------- | ------------------- | ------- |
| Framework        | Next.js App Router  | 14.x    |
| Language         | TypeScript          | 5.x     |
| Styling          | **Tailwind CSS v4** | 4.x     |
| Animation        | Framer Motion       | 11.x    |
| State            | Zustand             | 4.x     |
| ML Runtime       | TensorFlow.js       | 4.x     |
| Object Detection | COCO-SSD            | latest  |
| Icons            | Lucide React        | latest  |
| Hosting          | Vercel (free tier)  | —       |

**Do not introduce new dependencies without explicit user approval.**
The ₹0 budget constraint is real — no paid APIs, no paid services.

---

## Tailwind v4 Rules — Critical

This project uses **Tailwind CSS v4**. The config file approach is gone.

✅ Theme is defined in `app/globals.css` using `@theme {}`
✅ PostCSS plugin is `@tailwindcss/postcss` in `postcss.config.mjs`
❌ There is NO `tailwind.config.ts` — do not create one
❌ Do not use `theme()` or `extend` — they are v3 patterns

**Custom tokens available:**

```
Colors:     bg-hud-cyan, bg-hud-dark, bg-hud-panel, border-hud-border, shadow-hud-glow
Fonts:      font-orbitron, font-mono
Animations: animate-scan, animate-pulse-hud, animate-glitch
```

If you need a new design token, add it to the `@theme {}` block in `app/globals.css`.
Do not use arbitrary Tailwind values like `bg-[#00D4FF]` — use the named tokens.

---

## Architecture Rules

### Client vs Server Components

- **All camera, ML, geolocation, and device API code MUST be `'use client'`**
- Browser-only APIs (`navigator`, `window`, `document`) must be inside `useEffect` or
  guarded with `typeof window !== 'undefined'`
- Never call `Date.now()`, `Math.random()`, or any browser API at the module level in
  a server component — this causes hydration mismatches

### File Structure

```
app/
  layout.tsx          # Root layout — fonts, metadata, suppressHydrationWarning on body
  page.tsx            # Entry point — mounts the HUD
  globals.css         # Tailwind v4 @theme, global resets
components/
  camera/             # CameraFeed, useCamera hook
  hud/                # HUD panels (TopLeft, TopRight, BottomBar)
  detection/          # BoundingBoxes, useDetection hook
  overlays/           # Scanlines, AnimatedGrid, CornerBrackets
hooks/
  useCamera.ts        # getUserMedia, video ref management
  useDetection.ts     # TensorFlow.js inference loop
  useLocation.ts      # navigator.geolocation.watchPosition
  useWeather.ts       # OpenWeatherMap fetch + cache
  useBattery.ts       # Navigator.getBattery
store/
  hudStore.ts         # Zustand store — detections, location, weather, UI state
lib/
  constants.ts        # Colours, thresholds, API endpoints
  utils.ts            # Shared helpers
```

### Naming Conventions

- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts`, always prefixed with `use`
- Store slices: named by domain (`detectionSlice`, `locationSlice`)
- CSS classes: Tailwind utility-first, no custom CSS unless animation keyframes

---

## Performance Constraints

These are hard limits — the app runs on mid-range Android phones:

| Metric                 | Target         |
| ---------------------- | -------------- |
| Initial load           | < 5s on 3G     |
| CV model load (cached) | < 3s           |
| Detection FPS          | ≥ 10 FPS       |
| JS heap                | < 300 MB       |
| Battery drain          | < 10% per hour |

**Rules to enforce this:**

- TensorFlow.js and COCO-SSD must be **lazy loaded** — never in the initial bundle
- Use `dynamic(() => import(...), { ssr: false })` for all ML components
- Run CV inference in a **Web Worker** (Phase 4) — never block the main thread
- Cache all external API responses (weather: 5min TTL, geocoding: distance-gated)
- Debounce geolocation updates — only re-query after device moves > 50m

---

## External APIs — Free Tier Limits

| API            | Limit          | Caching Strategy                             |
| -------------- | -------------- | -------------------------------------------- |
| OpenWeatherMap | 1M calls/month | 5-minute TTL in Zustand                      |
| Nominatim/OSM  | 1 req/sec      | Cache by GPS tile, invalidate after 50m move |
| OpenAQ         | Unlimited      | 10-minute TTL                                |
| Wikipedia      | Polite use     | Cache per landmark indefinitely              |

**Always implement fallback UI when an API is unavailable.** The camera and
object detection must work completely offline — they are the core experience.

---

## Privacy Rules (Non-Negotiable)

- **Never store raw camera frames** anywhere — not localStorage, not a server
- Face detection results must be **aggregate only** — count of faces, not identities
- If storing session data to MongoDB, implement an **incognito mode toggle** that
  disables all logging
- No analytics without user consent
- GPS coordinates must not be sent to any third party beyond the approved API list above

---

## HUD Visual Identity

The aesthetic must stay consistent. Do not deviate from this:

| Property         | Value                              |
| ---------------- | ---------------------------------- |
| Primary colour   | `#00D4FF` (hud-cyan)               |
| Background       | `#0A0A0F` (hud-dark)               |
| Panel background | `rgba(0, 212, 255, 0.05)`          |
| Border           | `rgba(0, 212, 255, 0.3)`           |
| Primary font     | Orbitron (headings, labels)        |
| Data font        | Share Tech Mono (values, coords)   |
| Corner brackets  | Always present on HUD panels       |
| Scanlines        | CSS pseudo-element overlay on root |

All text must be readable against the dark background. No white backgrounds.
No rounded corners > `rounded-sm` on HUD panels — keep it angular and technical.

---

## Build & Dev Commands

```powershell
npm run dev          # Local dev server (localhost:3000)
npm run build        # Production build — must pass before any PR
npm run lint         # ESLint — fix all errors, warnings are acceptable
vercel --prod        # Deploy to production
```

**The build must pass cleanly.** Do not commit code that fails `npm run build`.

---

## Phase Boundaries — Do Not Cross

Work is divided into 4 phases. Do not implement Phase 2+ features while Phase 1 is incomplete.

- **Phase 1 (Weeks 1–3):** Camera feed + COCO-SSD detection + HUD panels
- **Phase 2 (Weeks 4–7):** GPS, weather, AQI, landmark enrichment
- **Phase 3 (Weeks 8–10):** MediaPipe faces, Tesseract OCR, Web Speech API
- **Phase 4 (Weeks 11–13):** Web Workers, PWA, performance, launch

If asked to implement something from a later phase, flag it and confirm with the user first.

---

## What Agents Should NOT Do

- ❌ Add paid services or APIs
- ❌ Create `tailwind.config.ts` (v3 pattern — this project uses v4)
- ❌ Use `<form>` elements — use controlled inputs with `onChange`/`onClick`
- ❌ Add server-side camera or ML processing — everything runs client-side
- ❌ Store camera frames or individual face data
- ❌ Skip `'use client'` on any component that uses browser APIs
- ❌ Inline styles instead of Tailwind tokens
- ❌ Break the HUD aesthetic (no light themes, no rounded cards, no generic UI)

---

## Privacy Rules — Non-Negotiable

This project operates on a strict zero-external-data policy.

**NOTHING leaves the device except:**

- TF.js model file download on first load (model weights only, no user data)

**PERMANENTLY REMOVED — do not reintroduce:**

- ❌ Nominatim / OpenStreetMap reverse geocoding
- ❌ OpenWeatherMap or any weather API
- ❌ OpenAQ or any air quality API
- ❌ Wikipedia or any landmark API
- ❌ MongoDB Atlas or any database logging
- ❌ Sentry or any error tracking service
- ❌ Any analytics, telemetry, or usage tracking

**Local-only alternatives in use:**

- Location label → formatted from raw GPS coords (formatCoords helper)
- Time/temperature slot → local device clock (useLocalTime hook)
- All ML inference → TensorFlow.js on-device (COCO-SSD)

## Approved External Services

| Service                                 | What's Sent                                           | What's NOT Sent                        |
| --------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| Gemini 2.0 Flash-Lite (via /api/corvus) | Voice transcript, object names, heading, battery, fps | GPS coordinates, camera frames, images |

All Gemini calls go through /api/corvus serverless function.
The API key lives in Vercel env vars — never in client code.
GPS coordinates must never be added to the Gemini context.

_Project: IRONMAN-HUD-01 · Author: Nirmal · License: MIT · Budget: ₹0_

<!-- END:nextjs-agent-rules -->
