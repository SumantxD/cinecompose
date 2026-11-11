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

## Terrain — inside `ForestEnvironment` 🔧
A 320 m ground plane displaced by fbm, flattened near the road, plus a `terrain(x, z)` offset from the set (for example `groundLevel` for the track embankment).
📋 Extract into `Terrain.tsx` with a shared `height(x, z)` export so props can sit on it without each set re-deriving it.

## Road — `components/VillageRoad.tsx` ✅
A crowned, broken-edged asphalt strip with puddle-aware colour and roughness maps, leaf litter, and an optional `terrain` ramp. Also `Milestone` (an orange cap means a village road).

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
