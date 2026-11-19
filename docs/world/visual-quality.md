# Visual Quality Control

"It compiles" is not "it looks right". Every environment change goes through this checklist **with screenshots**, at 390×844 (portrait, primary) and 1280×720.

## Measure, don't eyeball

| Tool | What |
|---|---|
| `scripts/shoot.js` (paste the `shoot([...])` helper into the dev page, or see the inline version in the session log) | Grabs exact story moments from the canvas into `captures/frames/` (dev-only `/__capture` endpoint) |
| `scripts/luma.sh captures/frames/*.jpg` | Mean luma and spread per frame |
| `ffmpeg -pattern_type glob -i 'captures/frames/*.jpg' -vf "scale=195:-1,tile=8x4" sheet.jpg` | A contact sheet of every shot. Look at it, not just the numbers. |
| `?auto=0,1,0` + screen recording → `scripts/analyze-video.sh run.mp4` | Per-second luma, cut detection and a contact sheet of a real playthrough |

**Targets:** story frames average luma 40–57 (0–255) with spread ≥ 60. No stretch of black longer than a deliberate cut (EDT-01) plus about 2 s. Adjacent shots within ±15 luma unless the jump is the point.

## How to capture
`npm run dev` → Chrome → tap to begin → dev console `kr.start('<knot>'); kr.skip(<seconds>)` → screenshot. Capture the first frame of every shot and every cue moment where the entity changes.

## Checklist

**Scale and grounding**
- [ ] Terrain has intentional, bounded physical relief, not just a normal map. The path need not be perfectly flat; props root slightly into the same height function used by the ground and mist (`reference-forest/layout.ts` is the reference).
- [ ] Doors about 2 m, people 1.6–1.8 m (she is 1.84 m), road 5–6 m wide, rails 1.676 m apart.
- [ ] Nothing floats: posts, trunks and props sink slightly into the ground (root flares, buried bases).
- [ ] No z-fighting or flicker where surfaces meet (road/panel, decals).

**Composition**
- [ ] The subject sits in the middle third of the portrait frame, with captions clear of the bottom 20%.
- [ ] There's a deliberate dark region (FRM-01), and it's composed, not accidental.
- [ ] Nothing important is cut off in portrait that's visible in landscape.

**Light and atmosphere**
- [ ] Material albedo is plausible: no texture darker than about sRGB 40 except deliberate voids. (2026-11-08: the asphalt was at sRGB 24–50, effectively black paint, which hid the road everywhere outside one lamp pool.)
- [ ] You can tell what the ground is in every frame. Blacks aren't hiding missing work.
- [ ] Distance layers: near silhouettes are darker than the far haze.
- [ ] Warm light means her and cool light means the living (`visual-language.md`).
- [ ] Bloom only on real light sources. No clipped white areas larger than a lamp.

**Variety**
- [ ] No identical repeated object is visible side by side (vary rotation, scale and tint; use ≥ 4 archetypes).
- [ ] Surfaces have breakup: wetness, dirt, edge wear.

**Camera**
- [ ] The camera never clips through geometry for any aspect between 9:16 and 21:9.
- [ ] No camera position below the terrain (check low-angle shots near ramps and embankments).

**Regression**
- [ ] `npm run typecheck && npm run check` pass.
- [ ] Console has no errors (one "THREE.Clock deprecated" warning comes from R3F internals and can be ignored).
- [ ] Draw calls and triangles are within budget (`performance.md`). Add a row to "Measured".
