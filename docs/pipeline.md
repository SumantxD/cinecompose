# Production Pipeline

## Add a scene to an existing environment

1. Add a JSON file to the environment's folder, e.g. `src/scenes/railway-crossing/crossing_horn.json`, with a unique `sceneId`. The schema is in `src/cinematic/types.ts`.
2. Write `shots` (their durations must add up to `duration`), `cues` (light/entity ids are listed at the top of the Env file), and `audio.ambience`.
3. Tag the Ink line with `# scene: crossing_horn` (it's probably there already, as an animatic).
4. Run `npm run check`, then `npm run dev` and `kr.start('<knot>')`. Check the scene at 390×844 and 1280×720.
5. Note in the scene's Ink stage direction which techniques it uses (IDs from `docs/cinematics/horror-techniques.md`).

## Add a new environment (a set)

1. Create `src/scenes/<env>/<Name>Env.tsx`. Compose it from `components/` and add new reusable pieces there, not inside the Env file.
2. Register it in `src/scenes/registry.ts` under its environment key.
3. List its cue-targetable ids (lights, entities) in a comment at the top.
4. Use seeded randomness only. Read `terrain`/`groundLevel` helpers instead of guessing y-coordinates.
5. Add it to the locations table in `docs/bible/world.md`.

## Assets

See `docs/world/asset-pipeline.md` (sources, licensing, AI-generated 3D rules, optimisation, manifest).

## Reels export (📋 next major system)

The goal is 1080×1920 MP4 with cinematic, captions burned in, audio, and no choice buttons, ending on the decision prompt (REL-02).

Plan:
1. A `?export=<knot>` mode: deterministic stepping (`player.tick(1/30)` per frame, rAF disabled), with the Canvas fixed to 1080×1920 and captions drawn into the canvas.
2. Capture frames from `canvas.toBlob` → upload to a local `scripts/export-server.mjs` → ffmpeg encodes them.
3. Audio: render the scene's sound cues offline (an OfflineAudioContext version of AudioManager, using the same manifest), then mux with ffmpeg.
4. A Reel spec file per episode lists knot ranges, a cold-open clip (REL-01), and an end card.

Fallback until then: screen-record the dev build at 390×844 in Chrome DevTools device mode.

## Deploy

`npm run build` → `dist/`. Cloudflare Pages: build command `npm run build`, output `dist`. Vercel works the same way. No server is needed.

## Before every commit

`npm run check && npm run typecheck`. Update the "Current state" section of `CLAUDE.md` if the state changed. Log any decisions.
