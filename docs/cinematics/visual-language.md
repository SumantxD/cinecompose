# Visual Language

## Palette

| Role | Colour | Where |
|---|---|---|
| Night base | `#0c1117` blue-black (fog, background) | everywhere outside |
| Sodium | `#ff9a40` warm orange | street lamps, her backlight, puddle glints |
| Tube light | `#d6f2e4` cool green-white | government and domestic interiors, the gate cabin |
| Signal red | small and dim only | railway signal, STOP disc, sari border |
| Sky | `#13161a` at the horizon to `#030406` at the top | overcast monsoon cloud |

**Rule:** warm light means her; cool light means the world of the living. Use that contrast on purpose.

## Grade (`cinematic/PostFX.tsx`, shared by every scene)

ACES filmic, saturation −0.22, contrast +0.08, vignette 0.78, film grain (screen, 0.32). Bloom only on true light sources (threshold 0.85), and off on low-quality devices. Don't add per-scene grade tweaks unless it's logged in `decisions.md`.

## Atmosphere

Depth comes from **atmospheric perspective**: the fog colour sits *above* the darkest silhouettes, and the sky's horizon matches the fog exactly (`FogSystem` does this). Near trees read black, the middle distance grey-blue, and the far distance dissolves. If everything is the same darkness, the fog is too dark.

## Composition

- Negative space is a tool (FRM-01). Leave room where someone could be.
- Use dead-centre symmetry for her, and off-centre framing for Aarav (FRM-03).
- Horizontal lines (booms, thresholds) separate the living from her (FRM-02).
- Readability: every frame must show where we are. If you can't tell what the ground is, the frame is too dark.

## Framing by device

- **Portrait 9:16 is the primary frame.** Author `fovPortrait` for every shot (usually about 1.45× the landscape FOV). The subject should sit in the middle third vertically. Captions take the bottom 20%.
- Landscape 16:9 uses the same shot with a narrower FOV. `CameraController` blends between the two for in-between aspect ratios.

## Camera

Slow. Every move has a reason (see `horror-techniques.md`, CAM-*). No shake. The breathing drift is preset-controlled and should stay below 2 cm.

## Typography

Cormorant Garamond for captions, choices and the title. Tiro Devanagari Hindi for Hindi. Narration is italic. Dialogue has a small spaced-caps speaker label above it. The title letter-spacing is wide and the fade is slow.
