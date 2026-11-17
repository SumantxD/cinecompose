# First playable episode — release package

This package contains the complete playable crossing episode, its tea-stall and childhood-house investigation, the return road and all four authored endings. It does not invent later episodes or seasons that have not been written.

## Run

Requires **Node 24.x**, with npm.

```sh
npm ci
npm run check
npm run build
npm run preview -- --host 0.0.0.0
```

Open **`/index.html?start=part1`**. The canonical deployed URL has the same `/index.html?start=part1` query. The static host must return `index.html` for unknown document paths so `/index.html` and `/` both work normally.

An old `?start=arrival` URL opens the recovery screen; **Start over** enters the current episode. Audio begins after the user's entry gesture. Production does not expose `kr`, `r3f`, the Studio or Character Lab through the episode URL. Authoring uses the separate development-only routes described below.

## Deploy

This is static hosting: **build command `npm run build`, output directory `dist`, Node 24.x**. Configure the provider to serve the generated `dist/` directory. No database, game server or external asset API is required.

`public/` is copied into the build: animation GLB, texture maps, local TTF fonts, complete font licenses and public credits. `index.html` loads `/fonts/fonts.css`; no Google Fonts runtime request is needed.

The tested local server remains available at **http://localhost:5174/index.html?start=part1** while this session's preview process is running. This is not a claim of a public hosted deployment.

With `npm run dev` running, `node scripts/check-voice-playback.mjs` checks the provisional Hindi audio: decoded duration, start gesture, pause/resume, exact seek, silent scrubbing, unchanged scene JSON and delayed-request cancellation. The female comparison and model weights stay outside the release. New voices still require their own provenance and real playback checks.

## Authoring (development only)

```sh
npm run dev
```

- `/?studio` — scene editing/director workspace.
- `/?character` — Character Lab and licensed motion library.

Ink is authoritative for story; scene JSON is authoritative for shots and timing. The repository contains the integrated episode inputs: rebuilding it never depends on temporary generation scripts. Director navigation and Character Lab previews do not alter film scene data without an explicit save.

## Checks

```sh
npm run check
npm run typecheck
node scripts/check-assets.mjs
node scripts/check-curves.mjs
node scripts/check-character.mjs
node scripts/check-animation-library.mjs
node scripts/check-views.mjs
npm run build
```

The story walker verifies **78 paths, two death outcomes, four authored endings and no animatic-only scene**. It is not a claim that every route was played in real time. A separate captured production route reaches an ending through the actual UI. `scripts/audit-scenes.mjs` provides repeatable portrait and landscape captures; camera/contact findings are diagnostic, not a substitute for viewing the images.

Movement, cameras, train motion, atmosphere, procedural effects and character motion use scene time. Characters walk above the analytic road surface; sitting actors keep their seating placement. Outdoor rain pauses under shelter while the interior rain sound remains. The pillow, horse, radio, photograph and diary are procedural set pieces, not externally sourced photographs of people.

## Honest limits

- Characters are stylized procedural figures, not photorealistic cast scans. Meera, the Woman and Aarav preserve their canon age, concealment and silhouette rules.
- The application starts **muted**; no rain, procedural effects or voice play until the player explicitly taps **Unmute**. The opening Hindi narration is a provisional, license-recorded Kokoro `hm_omega` WAV. The rest of the dialogue remains captioned. This is AI narration awaiting performance approval, not a completed voice cast or a runtime TTS service.
- No arbitrary-character GLB retargeting promise. The motion importer targets the bundled CC0 source hierarchy/shared 18-bone rig; lab character appearance is procedural.
- Indoor shelter masks outdoor rain; there is not yet a separate library of exterior-view rain portals for every window.
- ATM-01 is a restrained, surface-fitted mist treatment, not a 20-effect VFX catalogue, fluid simulation or ray-marched volume.
- The episode is playable, but the separate Reels director exporter and free-roam gameplay described in `docs/direction/README.md` are not represented as shipped features.
- A route count, clean console or contact probe is not a full artistic quality approval. Use the retained portrait/landscape evidence and check the target device yourself.
- No public host deployment, app-store package, compatibility certification or commit is implied by this local release package.
