# World Engine Architecture

How a scene becomes pixels, and the audit history of the engine.

## Layers

```
Ink beat ──► scene JSON ──► timeline (GSAP, paused) ──► scrubbed by clock.t every frame
   │             │ shots      → cam proxy → CameraController (aspect-aware FOV, drift, roll)
   │             │ cues       → store (lights, entities, title, fade) / AudioManager
   │             │ techniques → macros expand into cues (cinematic/techniques.ts)
   │             └ environment key → registry → <Env> set
   └ lines (# at/hold) → captions on the same clock
```

The `<Env>` set is built from independent systems (see `environment-library.md`): **atmosphere** (fog, sky, mist), **terrain** (ground plus height functions), **road**, **vegetation**, **architecture/props**, **lights**, **rain**, **entity**. Each one is seeded and deterministic, and none reads wall time.

## Rules for new systems

- Repeated things are **one InstancedMesh per archetype**, never one React component per object.
- Heights come from **analytic functions** (`groundLevel`, `roadRamp`, the forest `height`), never raycasts against terrain.
- Animation reads `clock.t`. Shaders get it through a uniform ticked in `useFrame` (see `withWind`).
- Anything a cue can target has a string `id` and reads its state from the store.

## Dependency decisions (audit 2026-11-08)

| Suggested | Decision | Why |
|---|---|---|
| drei, postprocessing, GSAP, zustand | ✅ already in use | |
| `@react-three/rapier` | ❌ not now | The viewer never touches anything. Doors and props are cue-animated. Physics would add ~600 KB of WASM for nothing. Revisit if a scene needs simulated debris or cloth. |
| `leva` | ❌ not now | Tuning happens in scene JSON plus the `kr` dev console, which is reproducible and commits to git. A Leva panel's values vanish on reload. Revisit when lighting passes need many live sliders, and then dev-only. |
| AI 3D generators (Meshy, Tripo, Rodin, Hunyuan3D) | ⚠️ case by case | They conflict with the brief's "no paid AI generation". Free tiers have output-license limits that vary by tool and change over time. See `asset-pipeline.md`. |

## Audit log

### 2026-11-08: railway crossing, after v1
Measured at 1280×720 on an M4 Pro: about 96 draw calls and about 700k triangles per frame. **About 1.3M triangles per two frames came from the forest crowns** (4,200 instanced icosahedra at 320 triangles each). Visually, the crowns read as black "lollipops", the main thing that made the scene look procedural. The fog colour was nearly the same as the tree colour, so distance didn't separate into layers.

**Highest-impact fix:** a forest rebuild. Seeded sal archetypes (tapered curved trunks and branches, alpha-cut leaf cards with crown-spherical normals), instanced per archetype, a wind-sway shader, trees biased toward the road edge, and an atmosphere pass where the sky horizon matches the fog colour. Result: 574k triangles and 135 calls on desktop, 375k and 107 on the mobile profile. The forest now reads as layered trunks dissolving into rain haze.

**Remaining weaknesses, ranked:**
1. Hard-surface materials are flat (canvas colour only, no normal or roughness detail on concrete, plaster or metal). → CC0 PBR set (ambientCG/Poly Haven) for asphalt, concrete, lime plaster, rusted steel, ballast.
2. The gate cabin, barrier posts and signal are box primitives up close. → procedural detail pass (brick courses, window frames, corrugated awning) or a CC0/AI GLB hero asset.
3. No ground contact shading: objects sit *on* ground rather than *in* it. → baked contact-shadow decals, or drei `ContactShadows` limited to hero props.
4. Rain has no ground interaction. → splash ripples in puddles (a shader on road roughness).
5. The bundle is 1.5 MB minified. → code-split environments per scene.
