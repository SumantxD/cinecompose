# KAALI RAAT — project instructions

This file is the project's living system prompt. Every session (human or Claude) reads it first. When a decision changes how we work, update this file in the same change. Keep it short. Detail goes in `docs/`.

## What we're making

**KAALI RAAT — The Road That Remembers.** An Indian folk/psychological horror series told as **interactive cinema shot like a horror film**: Aarav is on screen, in real film coverage (wides, over-the-shoulder, tracking, inserts). **It is not an FPS.** Decisions are the only interactive part. A narrator speaks to the player in second person ("you" are Aarav) and asks what they'll do. Decisions can be wrong, can get you captured, or can kill you. Every major moment is designed to be clipped as a vertical Reel, where the viewer notices what "you" didn't. Mobile-first (9:16, opened from Instagram), desktop second (16:9). Each episode is about 5–7 minutes long, with 3 decision points and several endings. Cutdowns go to Reels and end on a decision ("What would you do?"); the website is the canonical experience.

Priorities, in order: **story → composition → psychological horror → visual coherence → working branches → performance → maintainability.**

## Read before you touch anything

| If you're working on… | Read first |
|---|---|
| Product direction (Reels, first-person, gameplay horror) | `docs/direction/` (start with its README) |
| Any story, dialogue, choices | `docs/bible/story.md`, `docs/script-format.md` |
| The woman / anything supernatural | `docs/bible/entity.md` (her rules are strict) |
| A scene's camera, light, timing | `docs/cinematics/horror-techniques.md`, `docs/cinematics/visual-language.md` |
| Places, props, signage, period detail | `docs/bible/world.md` |
| Building 3D sets / reusable world systems | `docs/world/environment-library.md`, `docs/world/architecture.md` |
| Assets (CC0, GLB, AI-generated) | `docs/world/asset-pipeline.md` |
| Frame rate, mobile | `docs/world/performance.md` |
| Checking a visual change | `docs/world/visual-quality.md` |
| Sound | `docs/bible/sound-language.md` |
| Adding scenes, Reels, deploy | `docs/pipeline.md` |
| Why something is the way it is | `docs/decisions.md` |

## Golden rules

1. **The bible is canon.** If code and bible disagree, the bible wins. Fix the code, or change the bible deliberately and log it in `docs/decisions.md`.
2. **Log decisions.** Any creative or technical choice someone could later wonder about gets a dated line in `docs/decisions.md`. New horror techniques go in `docs/cinematics/horror-techniques.md` (with an index row, plus a macro in `cinematic/techniques.ts` if it's expressible as cues).
3. **Story lives in Ink, timing lives in scene JSON, look lives in components.** Never hardcode dialogue or choices in React. Never hardcode camera moves in components.
4. **Everything visual reads `clock.t`, never wall time or `Math.random()`.** Use `utils/random.ts` (seeded). This is what lets Reels be rendered frame-exact.
5. **Code-first assets.** No Blender, no paid assets, no AI image/video. Use procedural geometry and CC0 assets only. Record every external asset in `public/CREDITS.md` with its license *before* committing it.
6. **No placeholder boxes in final visuals.** If a model doesn't exist, build a coherent procedural one.
7. **Restraint.** No random shake, glitch overlays, saturated red, or loud stingers. Darkness must never hide poor work; the frame must stay readable.
8. **Improve before expanding.** Make the existing scene genuinely frightening before building new environments. Fix the weakest visible thing first (the ranked list is in `docs/world/architecture.md`).
9. **Mobile is the primary target.** Check every scene at 390×844 portrait. Give shots a `fovPortrait`. Touch targets are at least 56px. Text is never small.

## Architecture (where things live)

```
src/
  story/episode-001.ink      Ink script: the whole episode, all branches (compiled at build by vite.config.ts)
  story/StoryEngine.ts       Ink → beats (scene id + lines + choices). Erasable TS; Node imports it.
  scenes/<folder>/*.json     Scene configs: shots, lighting, ambience, timed cues, technique macros (schema: cinematic/types.ts)
  scenes/<folder>/*Env.tsx   The 3D set for an environment key
  scenes/registry.ts         environment key → set; auto-loads every scene JSON; animatic fallback
  cinematic/                 clock, camera presets, technique macros, GSAP timeline builder, CameraController, PostFX
  components/                Reusable set pieces: road, forest + vegetation kit, crossing, lights, rain, atmosphere, Entity
  audio/                     manifest (sound ids) → recorded file or procedural synth fallback; Howler manager
  app/                       player (story ↔ timeline), Stage (Canvas), Overlay (captions, choices, gate)
  state/store.ts             zustand: phase, captions, choices, light modes, entity states, flags
scripts/check-episode.mjs    walks every branch, validates scenes/sounds/speakers/timings
```

How a scene plays: the Ink beat names a `# scene:`, which loads that scene's JSON. A paused GSAP timeline holds the shots, cues and captions. `player.tick()` scrubs it with the scene clock. At the end the player either shows choices or moves to the next beat. A scene id with no JSON plays as a **black animatic** (rain plus captions), so the whole episode stays playable while sets are being built.

## Commands

```
npm install
npm run dev        # http://localhost:5173  (?start=<knot>, e.g. ?start=arrival for the full episode)
npm run check      # branch walker. Run before every commit. Must pass.
npm run typecheck
npm run build      # static dist/ for Cloudflare Pages / Vercel
```

Studio (dev): `http://localhost:5173/?studio`. Pick a scene, click a shot, turn on 🎥 Free camera, frame it, click "Use my view as START", then 💾 Save. Space plays, ←/→ step, ⌘Z undoes, ⌘S saves. ⏺ Record clip downloads the scene as video.

Dev console (dev builds only): `kr.start('arrival')`, `kr.skip(12)` (advance 12s), `kr.choose(0)`, and `r3f` (the live R3F state, for `r3f.gl.info` measurements). The scene id shows in the top-left corner.

## Working conventions

- Code taste: minimal, in-place, reuse first. Match surrounding comment density, which is terse. Mark intentional shortcuts with `// ponytail: <ceiling> — <upgrade path>`.
- Repeated scenery is one InstancedMesh per archetype, never one component per object. Heights come from analytic functions, never raycasts.
- New camera behaviour goes in `cinematic/presets.ts`. New cue types go in `Cue` in `cinematic/types.ts` plus `runCue` in `timeline.ts`.
- New sound: add an id to `audio/manifest.ts` with a synth fallback, and record it in `docs/bible/sound-language.md`.
- Ink decides *what happens* (story, consequences, `# captured`, `# dead`). Scene JSON decides *how you experience it*. Never mix the two.
- **Film coverage by default** (decision #26): show Aarav (`Actor id="aarav"`). First-person shots are rare, motivated inserts only.
- **Judge visuals with numbers, not one screenshot:** grab frames (`scripts/shoot.js` via the dev page), then run `scripts/luma.sh` and build a contact sheet, or record a playthrough (`?auto=0,1,0`) and run `scripts/analyze-video.sh`. Target story-frame luma is 40–57 with spread ≥ 60, and there are no black stretches.
- **Nudge shots in the Studio** (`npm run dev` → `/?studio`). It edits the same scene JSON the game plays.
- Shader materials: build them in `useMemo` and mutate `material.uniforms`. **Never** use a JSX `uniforms` prop (R3F copies it, so animation silently freezes).
- Every shot moves unless it's a deliberate hold (decision #33).
- Every light or entity a cue targets needs an `id`. List the ids in a comment at the top of the Env file.
- Visual changes: screenshot at 390×844 and 1280×720 before calling them done. "It compiles" is not "it looks right".
- Commit small and keep `npm run check` green.

## Current state

Keep this section up to date. It's the handoff note for whoever comes next.

- **Built:** **Part 1 "The Crossing"** as a film. Every path is built: taxi arrival, walk to the gate, her move at the barrier, cross (death and dawn), turn back (the second shadow), look (capture), walk on, end crane. It also has Aarav, the driver and the taxi (procedural, with a walk cycle and real footsteps), spatial choices, the YOU DIED screen and checkpoints, the **Studio editor**, the night-sky fill, per-shot grading, and layered rain. Also: foundation; the forest rebuilt as a seeded sal vegetation kit with wind (2026-11-08 audit: −20% triangles, no more primitive look); atmospheric perspective (sky horizon = fog); technique macros (LGT-03, ENT-04, EDT-01, SND-05) and camera roll; the railway-crossing environment (LC Gate 47) and its prototype cinematic (`?start=prototype`, 27s); the Entity v1 (silhouette, reversed feet, head tilt); procedural audio for rain, drone, hum, tube tick and the three-note motif; the full Episode 1 script in Ink (27 paths, 3 endings) playable as an animatic (`?start=arrival`).
- **Next (visual):** Aarav and the taxi are procedural and read as mannequins up close. Keep them at medium/wide distance, or replace them with CC0 rigged GLBs (the Actor pivot names already match a humanoid rig). **Then:** (1) Reels capture: MediaRecorder for live play plus the frame-stepped director export (`docs/direction/reels-first.md`). (2) PLAYER POV drag-to-look during choices. (3) Flashlight and procedural first-person arms. (4) Entity close-up upgrade (her capture frame is too smooth). (5) The p1_car interior set. (6) A Part 2 rewrite for continuity. (7) Hard-surface PBR (CC0). Design the hostile chase entity with the team before building any chase.
- **Known gaps:** no recorded voice (captions only). "Return to the last decision" replays the whole beat (37 s for p1_road); consider fast-forwarding it. The bundle is 420 KB gzipped (code-splitting not done yet). Only one hum loop can play per sound id.
