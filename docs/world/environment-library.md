# Environment Library

Reusable building blocks for every set. If you build something reusable, it goes here. If you need something, check here first.

Legend: ✅ built · 🔧 partial · 📋 planned

## Atmosphere — `components/FogSystem.tsx` ✅
Exponential fog, a sky dome whose **horizon colour is the fog colour** (atmospheric perspective), and drifting fbm mist sheets that can be tinted by a lamp.
Props: `color`, `density`, `sheets[] {z, y, w, h, opacity}`, `glowPos`, `glowColor`.
Rule: the fog colour must be *lighter* than near silhouettes, or depth won't layer. Outdoor night: `#1d2631`–`#232d39`, density 0.025–0.035.

## Rain — `components/RainSystem.tsx` ✅
GPU line streaks in a camera-following box, brightened near up to 3 registered lights. Props: `count`, `box`, `wind`.
📋 Puddle ripples. 📋 Drips from roofs and trees. 📋 An indoor variant (rain only seen through windows).

## Environment FX — `environment/EnvironmentEffects.tsx` ✅
Opt-in per-scene `effects` array, authored and previewed in the Studio. **Lightning** builds seeded branching bolts and double-pulsed lights; **Tornado** renders a procedural funnel and instanced orbiting debris; **Earthquake** applies deterministic camera rumble without accumulating drift; **Flood** raises a standard-material water surface to its authored level. Every effect has id/type/start/duration/intensity, and no story scene receives one by default.

These are controllable cinematic approximations, not fluid dynamics, rigid-body destruction or a universal weather simulation. Optional type parameters include lightning position/seed, tornado position/radius/height/debris/seed, earthquake frequency, and flood level/colour. Existing rain, fog and shelter logic remain separate.

## Terrain — inside `ForestEnvironment` 🔧
A 320 m ground plane displaced by fbm, flattened near the road, plus a `terrain(x, z)` offset from the set (for example `groundLevel` for the track embankment).
📋 Extract into `Terrain.tsx` with a shared `height(x, z)` export so props can sit on it without each set re-deriving it.

## Road — `components/VillageRoad.tsx` ✅
A crowned, broken-edged asphalt strip with puddle-aware colour and roughness maps, leaf litter, and an optional `terrain` ramp. Also `Milestone` (an orange cap means a village road).

## Opt-in reference forest — `scenes/reference-forest/` ✅
`reference_forest` is an independent Studio scene for real-asset cinematic evaluation, not an Ink story change. Open `/?studio&scene=reference_forest` or use the scene dropdown. It uses the ordinary Stage/PostFX pipeline, seeded placements, analytic terrain height, shared fog/mist and the `ModelInstances` GLB loader. Close trees, real ferns, rocks, stumps, fallen wood and a brass diya are instanced from registered CC0 assets. Distant trees may use the source-derived alpha billboard.

Scene JSON `props.forest` controls seed, density, PBR texture scale/normal strength, physical terrain relief, wetness, wind, mist and puddles. The Rendering panel exposes those controls and independent HDRI illumination versus visible-sky choices. **Terrain relief (m)** adds small-scale physical bumps to the existing broad terrain, separate from normal-map grain. Zero restores the earlier flatter shape; the field is optional in older saved settings. Every placement and the mist shares the same height function, and puddles remain level. The compact **Cinematic look guide** in the Rendering panel records the transferable visual lessons from this approved reference. Quality profiles change density and resources, not texture resolution. Close props use actual shadow maps; distant trees and ferns avoid extra shadow work. The paper-like procedural bush experiment was rejected, and the third shot is placed in a clear camera corridor.

Original source links, authors, LOD triangle counts, bytes and SHA-256 hashes live in `public/models/forest/provenance.json`, `public/textures/forest_ground_04/provenance.json` and `public/CREDITS.md`. Rendered screenshots and luma checks supplement—not replace—art-direction approval. The forest's visual direction was approved before the terrain-relief refinement; the isolated template does not constitute blanket art or real-device FPS approval.

## Vegetation — `components/vegetation.ts` + `ForestEnvironment.tsx` ✅
- `salTree(seed)`: trunk and branches (bark) plus leaf cards. Six archetypes per forest; instance rotation, scale and tint vary them.
- `bush(seed)`, `grassClump()`: undergrowth.
- `withWind(material, {sway, flutter, base, top})`: wind for any material. Bark and leaves of the same plant **must** share `sway`, `base` and `top`.
- Placement is seeded. `clear(x, z)` excludes roads, tracks and buildings. Density is biased toward the road edge.
📋 Banana/bamboo clumps near houses. 📋 Dead branches and fallen logs. 📋 Wet leaf decals on the road.

## Railway — `components/AbandonedRailwayCrossing.tsx` ✅
Broad-gauge track (formation → ballast → sleepers → rails), the road ramp to rail-top (`roadRamp`, `groundLevel`), `Barrier` (with `raised`), `GateCabin`, `WarningSign`, `PowerLine` (sagging wires that sway), `Signal`.
📋 Train (headlight, cars rushing past at 20 m/s with a strobing gap). 📋 Rail shine streaks.

## Lights — `components/FlickeringLight.tsx` ✅
Point or spot light. Modes `off/on/flicker/dying` (deterministic), optional bulb (`tube`, `sodium`), glow sprite, volumetric `beam`, `hum` sound that follows the light's level, and registration in `lightRegistry` (rain reads it).
📋 Candle. 📋 Torch/flashlight. 📋 Car headlights (a pair of spots plus lens glow). 📋 TV glow.

## Entity — `components/Entity.tsx` ✅ v1
Silhouette, reversed feet, head tilt and snap. See `docs/bible/entity.md`.

## Architecture (buildings) 📋
Needed next: a procedural `House` (plinth, lime plaster walls with a dado, verandah posts, tiled or asbestos roof, wooden doors), `Corridor` (length is a parameter, for EDT-06), `TeaStall` (bamboo-pole frame, tarpaulin, counter). Build from parametric parts, not one-off meshes.

## Props 📋
Cassette player, old radio, wall calendar (canvas, Devanagari), wooden horse, family photograph (FRM-06), diary, kettle, chairs, ceiling fan (rotating, with light strobing through the blades), wall clock.
