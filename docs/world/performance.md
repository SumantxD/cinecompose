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
