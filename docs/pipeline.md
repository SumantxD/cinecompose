# Production Pipeline

## Add a scene to an existing environment

Use **Studio** (`npm run dev` → `/?studio`). Open a scene on the desired environment, then **＋** for a blank scene or **⧉** to duplicate the current one. It writes the JSON into the same environment folder.

1. The large view is always the **director Scene view**; the small render is the film camera. Playback moves the cyan camera icon without taking over director navigation. **◈** toggles authoring objects.
   - Camera paths are thick clickable pipes with shot endpoints numbered consecutively. Click a number or type the point number (a 350 ms buffer supports **11**, **12**, etc.) to scrub only the film preview to that point; this never teleports the director view. **F** focuses the selected point separately. Selected points and effect positions have transform handles; orbiting is suspended during handle drags.
   - Each consecutive pair of numbered nodes has its own green **+**, one per independent segment. Dragging a **+** stays within that pair; it cannot snap into the neighbouring segment or next film shot. Release to insert a point inside that continuous shot, not another film cut. **De Casteljau splitting preserves the curve; only that segment divides, while its neighbours, the shot and the total scene duration stay unchanged.** Select a point's IN/OUT diamond, then drag its single gizmo. The inspector exposes exact vectors and **Locked**, **Direction locked**, or **Free** handle modes. Leave the other shot timings; the new segments retain per-frame progress within their original easing range.
   - Use **Enable Bézier handles** for an existing shot, or insert a point to opt in. Legacy shots keep their original eased linear movement until then. Blue-to-orange pipe colour represents measured slow-to-fast movement in metres/second using the same 512-sample length table as playback.
   - Position and AIM handles are independent; use **switch to AIM** to edit looking direction and its own Bézier handles. The inspector exposes segment durations and easing. Only one transform gizmo is active at a time, so handle controls do not obscure the set.
   - No grid, aim lines, safe frames or frustum overlays. Studio text is selection-safe during drags; text inputs remain editable.
   - **T / B / L / R = orthographic Top / Bottom / Left / Right**, framed on the focused point. Top/Bottom expose X/Z; Left/Right expose Z/Y. The corner buttons switch views too. Drag empty canvas with LMB to resume free orbit around the **current focus**, with the same framing; a plain click keeps the current view. Gizmo and + drags remain edits. RMB/MMB pans, and scroll zooms without moving the focus. **Home returns to the perspective overview.** World-axis gizmos and undo work identically in these views; the film preview is independent.
   - Blender/Unity navigation: LMB orbit, RMB/MMB pan, scroll to fly forward/back at constant speed, WASD fly, Q/E down/up, Shift fast, F focus, Home overview. Scroll moves camera and pivot together: there is no exponential dolly, orbit-target trap or zoom limit. **Nav** tunes fly and zoom-compensated pan speed; close-up panning stays responsive.
   - **Use my view as START/END** transfers the director framing to the shot.
2. **START / END** and the XYZ buttons nudge in exact metre increments; exact aim coordinates remain under Exact numbers. Shot edges change duration; ◆ cues can be dragged to retime them.
3. **✦ Effect** adds a light, entity, 3D sound, ambience, title or fade at the playhead. Use the director camera target as its position, or drag its world marker afterwards.
4. **{ }** edits the complete JSON, including technique macros. Applying it is one undo step. Shot duration always derives from the shot list.
5. **Save** validates and writes the real scene JSON. Unsaved working copies auto-recover on reload as long as the underlying file has not changed. Switching scenes does not discard a draft. ⌘Z/⇧⌘Z undo/redo; Space plays; ←/→ step; ⌘S saves. Studio is silent while paused, scrubbing and at the end of playback; the speaker preference applies during Play. The director duplicate never emits audio.
6. Tag the Ink line with `# scene: crossing_horn` (it's probably there already, as an animatic). Run `npm run check`, then check playback at 390×844 and 1280×720. Note technique IDs in the Ink stage direction.

Manual alternative: add a JSON file to the environment's folder, with a unique `sceneId` matching its filename. The schema is in `src/cinematic/types.ts`; light/entity ids are listed at the top of the Env file.

## Add a new environment (a set)

1. Create `src/scenes/<env>/<Name>Env.tsx`. Compose it from `components/` and add new reusable pieces there, not inside the Env file.
2. Register it in `src/scenes/registry.ts` under its environment key.
3. List its cue-targetable ids (lights, entities) in a comment at the top.
4. Use seeded randomness only. Read `terrain`/`groundLevel` helpers instead of guessing y-coordinates.
5. Add it to the locations table in `docs/bible/world.md`.

## Character Lab

Open **`/?characters`** (or Scene from Studio). The lab is lazy-loaded, independent of episode scenes and cameras, and works without Blender, Mixamo or a server. It uses a procedural **18-bone `THREE.Skeleton` / `SkinnedMesh`**, not a UI mock-up.

1. **Motion:** choose idle/walk/creep, gait speed, posture, expression, gaze, breathing and steady/seeded unpredictable head motion. Ground contact keeps the feet planted during in-place motion. This is not a world path or an automatic replacement for `Actor`’s distance-driven footsteps.
2. **Pose:** select a joint in the dropdown or viewport, then Rotate/Move with the gizmo or numeric inputs. FK edits create a key at the playhead. **Motion → Head motion / Gaze** can drive the head; use manual gaze to pose it. Turn off ground contact before posing an ankle directly. Enable a hand IK target under Motion, then edit its XYZ target in body-root metres.
3. **Clip:** play/pause, scrub or step 1/30 s, name/rename clips, change duration, create/delete clips and use undo/redo (60 steps). Selection, attachment and camera navigation do not create keys. Space plays, ←/→ steps, ⌘Z/⇧⌘Z undo/redo. Bone and target keys remain local editor data, not scene JSON.
4. **Navigate:** LMB or one finger orbits; RMB/MMB or two fingers pans; scroll flies forward/back; two fingers pan/dolly. WASD/QE flies, Shift is fast, F focuses, Home frames the current pose, including elevated and floor-level motion. Phone drawers stay below the preview and scroll internally.

### Animation library

The library contains **35 retargeted CC0 clips and 100 authored presets (135 real motions)** across idle, locomotion, reactions, creatures, survival/combat, interactions, and facial presets. Search by words or filter by category. Downloaded motion covers only the lab's 18-bone rig; creature and combat presets do not add entities or combat to the film.

Selecting a card previews it without changing the saved document. Tune speed, strength, mirror, and loop before or during preview. Scrubbing and one-shot completion use the preview's duration, even when it is longer than the saved clip. Returning to the saved clip restores its own clock and pose; only an explicit **Use animation** or **Use expression** modifies it. Body replacement confirms existing keyed poses, replaces the body and its optional facial fields rather than merging incompatible face timelines, and remains undoable. Invalid candidates fail visibly without consuming undo or changing valid data.

**Use expression** keeps body tracks, IK, gaze, duration, and source metadata, and retimes facial keys to the saved duration. Facial Speed is intentionally unavailable in this UI; change **Clip duration** to control expression rhythm. Lower-level `setFace()` still supports independent timing settings. Body loops wrap, one-shots pause at their endpoint, and playback can restart from there. Saved looping clips retain the selected loop option. Crossfades freeze the outgoing pose even when seeking or rewinding the incoming clip.

The 35 source clips use the **CC0 1.0** KinemIQ/Quaternius pack. Attribution and the license are in `public/CREDITS.md` and `public/animations/`. Local rebuild:

```sh
node scripts/prepare-animation-pack.mjs /tmp/kaali-animation-source
```

This regenerates `kaali-raat-cc0.glb`, its metadata, and `src/characters/animation-source.ts`. The 3.3 MB pack contains source hierarchy/motion, not the source mannequin. It loads only when a licensed source motion is requested—not when opening the lab, authoring FK, using authored presets, or normal gameplay. Generated variations use a 24-entry cache; document clips contain their own baked keys. The retargeting is validated for this source hierarchy and shared rig, not arbitrary downloaded humanoids.

Licensed and authored downloads use **Library → Export animation .glb**. This exports the current variation with the procedural rig without applying it or changing the saved clip. The active-document Download .glb and Clip JSON controls remain separate. GLB and JSON re-imports are checked; glTF facial animation uses packed three-value morph-influence tracks.

**Save / exchange:** the whole versioned library (`{ version: 1, activeId, clips }`) autosaves to `kr-character-lab-v1`. **Clip JSON** downloads it; **Import clip JSON** validates the whole document (up to 2 MiB) before replacing it. Invalid imports leave the current library intact. Unreadable offline drafts retain raw recovery under `kr-character-lab-v1-recovery`; use Recovery JSON to download it. If browser storage is blocked, the editor warns and keeps the work available for JSON download.

**GLB:** Download .glb samples the active clip at **30 fps**, including bone transforms, face/mouth morph and skin weights. Bake on a cloned rig, restore it at clip time 0, and exclude editor targets/gizmos. Use the exported asset with your own `GLTFLoader` + `AnimationMixer`, or an engine’s glTF importer.

For reuse, `createCharacter()` in `src/characters/index.ts` returns a `CharacterController` with `{ rig, motion, play, update }`. `character.play({ movement: 'walk', speed: 0.4, posture: 'disturbed', expression: 'fear', gaze: 'camera', breathing: 'heavy', headMovement: 'unpredictable' })` accepts the same motion model shown in the UI. Supply explicit time to `update(time, context)`; `play` also accepts the current time and an optional transition duration. `await character.playClip('walk-forwards', { time, transition, offset, loop, speed, strength, mirror })` and `await character.setFace('face-scream', time, transition)` add the library without removing the procedural API. Pause, resume, seek, and explicit-time sampling stay independent of wall time. Add `rig.group` to your scene and call `rig.dispose()` when finished.

**Boundary:** this is a fixed procedural rig, not Aarav or the Woman. Episode actors keep their own rigs, story logic and framing. A shared face-feature factory supplies expressions/eyes; it does not replace their skeletons or motion. Story appearances may opt into local period-material and head-attachment components. There is no arbitrary GLB rig import/retargeting, world-walk controller, finger rig, or production Humanoid character construction yet. Position/target keys interpolate linearly; quaternion keys interpolate with quaternion interpolation. Adopt the core into a story actor only through an explicit integration.

## Assets

See `docs/world/asset-pipeline.md` (sources, licensing, local PBR materials, head attachments, AI-generated 3D rules, optimisation, manifest).

New scenes use shared hand anchors for carried props, named `Grounded` roots for floor/table contacts, and shoe-bounds correction against analytic heights. The diary fire is `props.paperBurn: { at, duration }`: it curls/chars the page on the scene clock using the existing material lighting, not a wall-clock overlay. The scene validator rejects negative, zero-duration or out-of-range burn timing, and Studio preserves it in validated writes/recovery. `RailwayCrossingEnv` uses the shared road-height correction for walking and standing actors; seated taxi actors retain their authored seat placement. Rain shelter bounds are analytic; the ceiling cutoff has a small margin for streak ends, and an interior camera disables the exterior emitter group. Exterior-through-window portal emitters are not implemented. `rain_indoor` supplies a low-passed indoor bed and roof-biased taps through scene audio configuration; exterior scenes retain outdoor rain. `props.groundMist` enables a bounded, height-fitted ground-mist field (ATM-01 in `docs/cinematics/horror-techniques.md`). Two mobile / three desktop procedural planes drift on `clock.t`; opacity and height are validated so subjects remain readable. It is not a volumetric/fluid simulation or a new post-processing pass. Camera/contact audit clones the camera and uses a separate double-sided contact probe; it never edits scene materials or camera placement. A named focus may mark the intentionally absent pre-reveal reflection, but genuine missing subjects and clipping remain failures. These are placement and camera/contact checks, not a full rigid-body simulation or a universal claim of visual naturalness.

New interiors use stronger soft fill and calibrated exposure for basic room visibility, independently of the original crossing lamps. Keep the plaster's brightness in its material tint rather than darkening the whole room again.

For a rendered audit, start the dev server and run `node scripts/audit-scenes.mjs http://localhost:5173/ /tmp/kaali-audit-1`. The audit covers the new tea-stall, childhood-house and return-road scenes at 390×844 and 1280×720, writes fresh evidence, and exits nonzero on non-optional issues or browser errors. Its geometry report supplements—not replaces—inspection of images, actual story playthroughs and the production build. A browser playthrough uses real choice buttons; in development, `kr.skip` advances the shared clock without replacing the Ink decisions. Run `node scripts/play-episode.mjs http://localhost:5173/ /tmp/kaali-playthrough-1 0,1,0,1,0,1`; add `--retry-death` for a route intentionally testing the death checkpoint. Without development diagnostics, the same runner waits at normal story speed. Reports and images go to a new directory, never over a completed run. `--production` additionally asserts that development controls are absent. `--all-shots` also captures each shot's middle frame for visual/luminance review. The browser client creates fresh tabs without modifying an existing user tab and closes the test targets when finished.

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

`npm run check && npm run typecheck`. `npm run check` walks the story and checks Bézier insertion, nested timing, handle invariants, degenerate targets, orthographic view framing/axis directions, saved-path validation, character skinning/IK/contact/motion, clip persistence and two-finger camera invariants. `scripts/check-animation-library.mjs` additionally validates every catalog motion, explicit-time playback/crossfades, facial/duration application, body-replacement edge cases, and official GLB re-imports. `scripts/check-character.mjs` checks that overview framing keeps translated/elevated/floor poses inside landscape and portrait frustums without modifying bones. Update the "Current state" section of `CLAUDE.md` if the state changed. Log any decisions.
