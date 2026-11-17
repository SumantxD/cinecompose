# Performance

The target is a **mid-range Android phone in the Instagram in-app browser** at 30+ fps. Desktop is easy. Story quality is never cut to save frames.

## Budgets (per frame, low quality / high quality)

| | Low (mobile) | High (desktop) |
|---|---|---|
| Draw calls (incl. shadow pass) | ≤ 120 | ≤ 200 |
| Triangles (incl. shadow pass) | ≤ 400k | ≤ 800k |
| Shadow-casting lights (on at once) | ≤ 2 (512²) | ≤ 2 (1024²) |
| Post passes | grade + grain + vignette | + bloom |
| Rain streaks | 2,500 | 6,000 |
| Device pixel ratio | 1–1.25 | 1–2 |
| Texture memory | ≤ 64 MB | ≤ 256 MB |

## Measured

| Date | Scene | Profile | Calls | Tris | Notes |
|---|---|---|---|---|---|
| 2026-11-08 | crossing_prototype @15s | desktop high | ~96/frame | ~700k | before the forest rebuild |
| 2026-11-08 | crossing_prototype @15s | desktop high | 135 | 574k | after the forest rebuild; 120 fps (M4 Pro, display-capped) |
| 2026-11-08 | crossing_prototype @0.5s | mobile low (390×844 emulated) | 107 | 375k | |
| 2026-11-08 | p1_turn @18s | desktop high | 132 | 766k | two shadow-casting sodium lamps + PlayerShadow + shadow-only entity |

**How to measure** (dev console during playback):

```js
const g = r3f.gl; g.info.autoReset = false; g.info.reset()
requestAnimationFrame(() => { console.log(g.info.render.calls, g.info.render.triangles); g.info.autoReset = true })
```

⚠️ Desktop emulation doesn't measure phone GPU speed. Before release, test on a real ~₹15k Android phone over local wifi (`npm run dev` prints a Network URL).

## Editor rendering profiles

`src/cinematic/rendering.ts` defines the scene-level `rendering` block. A scene with no such block is unchanged; it retains the legacy grade, no N8AO/SMAA/DOF and the old DPR caps.

| Profile | Output DPR cap | AA | AO | Shadow map | Texture anisotropy |
|---|---|---|---|---|---|
| Ultra | 2 | SMAA Ultra | N8AO Ultra, full res | 2048 PCF soft | 8 |
| High | 1.5 | SMAA Medium | N8AO Medium, half res | 1024 PCF soft | 4 |
| Performance | 1 | SMAA Medium | N8AO Performance, half res | 512 PCF | 2 |

The Studio **Rendering** workspace saves these in scene JSON. It also exposes individual N8AO, SMAA/MSAA, shadow, texture-filtering, depth-of-field, bloom, grading, grain, chromatic aberration, restrained light shafts, HDRI intensity/rotation and tone-mapping controls. `scripts/check-rendering.mjs` checks the profiles, validation and the shadow-map release that keeps profile switches from accumulating GPU textures. Texture filtering is clamped to the GPU's real anisotropy limit; profiles never lower the source maps' resolution.

The budget readout samples the composed film renderer **after postprocessing**, with renderer-statistic resets disabled for the probe's frame interval. It reports a per-frame average of the complete compositor workload, not just the director guides. FPS is wall-time telemetry only and never advances the cinematic clock. These are actual browser-renderer counters, not device-independent performance guarantees.

## Levers, in the order to pull them

1. Shadow map size, and which objects `castShadow`. Leaves never cast shadows.
2. DPR cap.
3. Instance counts (trees, bushes, grass, rain), via `quality` in the Env.
4. Bloom off.
5. Fog density up and far plane down (fewer distant instances survive frustum culling).
6. Archetype detail (radial segments on trunks, cards per crown).

## Known costs
- The ground plane is 51k triangles. It could be split into a near-detail patch and a coarse far ring.
- PerformanceMonitor drops to low quality if fps falls, but never climbs back up (intentional, to avoid oscillation).

## Rendering quality implementation notes

- Explicit editor profiles override the legacy automatic low-quality fallback only for scenes with custom rendering settings.
- Studio has two Canvases (director and live film preview) by design. Check game output separately on a real phone; desktop emulation is not a phone GPU measurement.
- Local HDRI environment lighting uses only the 1K CC0 asset recorded in `public/environments/manifest.json`. It is opt-in per scene and does not replace the procedural night fill by default.

## Reproduce the editor audit

With the dev server running at port 5173 and `agent-browser` installed, choose a new evidence directory:

```sh
node scripts/check-editor.mjs http://127.0.0.1:5173 /tmp/cine-editor-audit-$(date +%s)
```

The audit covers profile persistence/undo, actual local HDRI loading, live DOF/light shafts, generated worlds, effects, save/reload, Character Lab export, mobile layout/accessibility and recording. It uses one managed browser session with a 150-second watchdog and explicitly closes only that session. Canonical JSON is compared before/after and must remain unchanged. A successful functional audit is not real-device performance approval or universal generated-world art approval.

`npm run check` also includes the static rendering and world tests, but currently remains blocked by the known full-Hindi publication mismatch: the generated metadata claims 149 clips while only one public WAV exists. The 41-check browser render/editor audit completed separately with no console/runtime errors and no canonical-scene rewrites.
