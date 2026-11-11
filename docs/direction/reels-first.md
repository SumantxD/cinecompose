# Reels-First (Phase 10)

**Requirement:** every major horror sequence is designed to be recorded and shared as a 15–30 s vertical Reel. This shapes world design, camera, lighting, entity staging and scripting from the start. It is not a feature added at the end.

The strongest viral mechanic: **the player doesn't notice the horror, but the person watching the Reel does.** The comment we want: *"WAIT. LOOK AT THE WINDOW."*

## Framing

- Compose every sequence for **9:16 first** and 16:9 second. Never just centre-crop landscape.
- Shots have `fovPortrait`, and `CameraController` blends between aspects. Entity placement is checked in portrait.
- **Safe area (1080×1920):** keep key action out of the top 220 px (profile/audio UI) and the bottom 380 px (caption, buttons, description), and stay at least 120 px from the right edge (like/comment rail). Our captions already sit in the bottom 20% and are burned in only for export.
- Keep depth in narrow frames: foreground silhouette, mid-ground subject, haze background.
- Every camera transition has to work in both orientations.

## Sequence structure (every shareable moment)

| Beat | What it does |
|---|---|
| **HOOK** (0–2 s) | The first frame is already wrong or beautiful. Never open on black in a Reel cut. |
| **BUILDUP** | A subtle anomaly creates uncertainty. |
| **DISCOVERY** | The viewer notices something the player might not. |
| **ESCALATION** | The anomaly becomes impossible to ignore. |
| **PAYOFF** | A reveal, an implication or a realisation. Jumpscares are the exception, not the tool. |
| **AFTERMATH** | A final image that makes people replay. |

## Replayability patterns
Entity visible in the background before the player enters. A figure that changes position between cuts. A reflection that doesn't match. A shadow that arrives before its owner. A background object that changes. A figure seen only at the edge of the frame. (Techniques: FRM-07, LGT-03, EDT-03, CAM-13, and the shadow-only entity.)

## Candidate moments (from the brief)

| Moment | Status |
|---|---|
| A. **The figure in the distance:** she's closer every time the camera comes back, never acknowledged | ✅ Part 1, `p1_road` |
| B. **The window:** a silhouette behind the window when you look away, then in the mirror | 📋 needs house set + FRM-05 mirror |
| C. **The impossible distance:** a tree passes the lens and the shrine is suddenly near | 📋 shrine set; CAM-12 |
| D. **The second shadow:** a shadow beside yours that keeps moving when you stop | ✅ Part 1, `p1_turn` / `p1_walk_on` |

## Capture and export

- **Live capture (players):** a `MediaRecorder` on `canvas.captureStream(30)`, mixed with the Howler master output (`Howler.ctx.createMediaStreamDestination()`). That gives a WebM/MP4 of the actual playthrough. Overlay UI isn't in the canvas, so it's excluded automatically, and captions must then be drawn into the canvas for the clip. 📋
- **Director export (our Reels):** deterministic frame stepping (`?export=<knot>` → `player.tick(1/30)` per frame → `canvas.toBlob` → local ffmpeg), 1080×1920, 15 s / 30 s cuts, burned-in captions, optional end card with the title, **no watermark during the horror**. See `docs/pipeline.md`. 📋
- Recording must not cost gameplay performance: capture only when the user starts it.
- Never include dev overlays (the scene id label is DEV-only) or choice buttons.

## Social quality gate (run it for every major sequence)

1. Is the **first frame** visually interesting?
2. Can the horror be understood **without narration** (sound off)?
3. Does it work in **vertical framing**?
4. Is the entity **clearly visible when intended**, and hidden when not?
5. Is there a **memorable reveal**?
6. Does it **reward a second viewing**?
7. Would someone **send this to a friend**?
8. Does it feel like **Indian folk horror**, not generic horror?

A failed answer means re-composing or re-timing. Write the gate results into the scene's Ink stage directions.

## Visual signature
Indian rural night, realistic architecture, deep shadows, restrained grade, unnatural stillness, specific cultural detail. No Western haunted house, no blood splashes, no horror filters. A frame should be recognisable as KAALI RAAT without a logo (see `docs/cinematics/visual-language.md`).
