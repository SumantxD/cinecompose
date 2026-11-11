# Horror Technique Library

A growing catalogue of cinematic horror techniques for KAALI RAAT. Each one has an **ID** you can cite in scene JSON, in Ink stage directions, and in reviews ("this beat needs a SND-02").

**Adding a technique:** give it the next ID in its category and fill in every field: *Effect* (psychological purpose), *Use when / Avoid*, *Build* (implementation and parameters), *Cost*, *Combines with*, *Used in*. Add a row to the index. If it can be expressed as cues, add a macro in `src/cinematic/techniques.ts`.

Status: ✅ built and used · 🔧 possible with current tools, not yet used · 📋 needs new engine work (the "Build" line says what)
Cost (per frame, mobile): **free** = cues/camera only · **low** = <1 ms, no extra pass · **med** = extra geometry or shader work · **high** = extra render pass (render target, DoF, reflection)

**Rules that override everything here:**
- Each technique must reveal something about the story. A scare with no meaning is noise.
- Don't repeat a technique within the same episode unless the repetition is the point (see SND-01).
- Horror budget for each episode: **at most one** loud moment. The rest is dread.

## Technique macros (composable)

A scene JSON can list techniques instead of hand-writing their cues:

```json
"techniques": [
  { "use": "ENT-04", "at": 9.0, "entity": "chudail", "position": [0.7, 0, -9.5], "motifDelay": 3.5 },
  { "use": "LGT-03", "at": 20.5, "light": "sodium_far", "entity": "chudail" }
]
```

Each macro (`src/cinematic/techniques.ts`) expands into ordinary cues on the scene clock, so any number of them combine with camera shots, audio and Ink line timing without conflict. `npm run check` rejects unknown IDs and cues that fall past the end of a scene.

| Macro | Params (defaults) |
|---|---|
| `LGT-03` Flicker Displacement | `light`, `entity`, `position?` (moves her; omit to hide her), `duration` (0.9), `settle` ("on") |
| `ENT-04` Appear Unseen + motif | `entity`, `position?`, `motifDelay` (3.5), `volume` (0.3), `motifFrom` ([30,3,-20]) |
| `EDT-01` Cut to Silence | `beds` (["rain","night_drone"]) |
| `SND-05` Pull the Rain | `sound` ("rain"), `duration` (10) |

## Index

| ID | Name | Status | Cost | Macro | Combines with |
|---|---|---|---|---|---|
| CAM-01 | The Patient Push | ✅ | free | — | FRM-02, FRM-03, ENT-01 |
| CAM-02 | The Camera That Won't Turn | 🔧 | free | — | SND-03, ENT-04 |
| CAM-03 | Ground-Level Witness | ✅ | free | — | LGT-01, FRM-01 |
| CAM-04 | Security-Camera Indifference | 📋 | med | — | FRM-07 |
| CAM-05 | Slow Pan to the Wrong Thing | 🔧 | free | — | FRM-05, FRM-06 |
| CAM-06 | Over-the-Shoulder Displacement | 🔧 | free | — | FRM-04 |
| CAM-07 | First-Person Breath | 🔧 | free | — | SND-03 |
| CAM-08 | The Long Hold | 🔧 | free | — | EDT-04, ENT-02 |
| CAM-09 | Descent to the Feet | 📋 | low | — | LGT-03, ENT-01 |
| CAM-10 | Dutch Angle | 🔧 | free | — | EDT-06, FRM-10 |
| CAM-11 | Focus Pull | 📋 | high | — | FRM-04, CAM-13 |
| CAM-12 | Camera Obstruction | 🔧 | free | — | FRM-08, FRM-07 |
| CAM-13 | Reverse Reveal | 🔧 | free | — | CAM-02, ENT-04 |
| FRM-01 | Negative Space Bait | ✅ | free | — | LGT-05, CAM-08 |
| FRM-02 | Under the Line | ✅ | free | — | CAM-01, LGT-01 |
| FRM-03 | Dead-Centre Symmetry | ✅ | free | — | CAM-01, ENT-01 |
| FRM-04 | Background Figure, Foreground Ignorance | 🔧 | free (high with DoF) | — | CAM-11, CAM-06 |
| FRM-05 | The Reflection Gap | 📋 | high | — | CAM-05, LGT-03 |
| FRM-06 | Photograph Wrongness | 📋 | low | — | CAM-05, EDT-03 |
| FRM-07 | Peripheral Apparition | 🔧 | free | ENT-04 / LGT-03 | CAM-12, EDT-03 |
| FRM-08 | Occlusion Reveal | 🔧 | free | — | CAM-12, ENT-04 |
| FRM-09 | Frame-within-Frame | 🔧 | free | — | FRM-01, CAM-08 |
| FRM-10 | Asymmetric Composition | 🔧 | free | — | FRM-01, CAM-10 |
| LGT-01 | Sodium Backlight Silhouette | ✅ | med (shadow map) | — | FRM-02, ENT-01 |
| LGT-02 | The Dying Tube | ✅ | low | — | SND-04 |
| LGT-03 | Flicker Displacement | ✅ | free | ✅ `LGT-03` | ENT-04, LGT-04, EDT-03 |
| LGT-04 | One Frame Closer | 📋 | free | — | LGT-03 |
| LGT-05 | Lit Room, Dark Doorway | 🔧 | free | — | FRM-01, FRM-09 |
| LGT-06 | The Candle Foreground | 🔧 | low | — | CAM-08 |
| LGT-07 | Light Avoids Her | 📋 | low | — | LGT-08, SND-04 |
| LGT-08 | Delayed Environmental Reaction | 🔧 | free | — | ENT-04, LGT-07 |
| EDT-01 | Cut to Silence | ✅ (macro) | free | ✅ `EDT-01` | SND-05 |
| EDT-02 | Delayed Reveal Cut | 🔧 | free | — | CAM-08 |
| EDT-03 | Continuity Error on Purpose | 🔧 | free | — | LGT-03, FRM-06 |
| EDT-04 | The Restrained Title | ✅ | free | — | CAM-08 |
| EDT-05 | False Reveal | 🔧 | free | — | FRM-07, EDT-03 |
| EDT-06 | Impossible Spatial Transition | 📋 | low | — | CAM-10, EDT-03 |
| SND-01 | The Three-Note Motif | ✅ | free | in `ENT-04` | everything with her |
| SND-02 | Voice Out of Its Source | 📋 | low | — | FAM-01, FAM-03 |
| SND-03 | Rhythm Matching | 📋 | free | — | CAM-02 |
| SND-04 | Mains Hum Bed | ✅ | free | — | LGT-02, LGT-07 |
| SND-05 | Pull the Rain | 🔧 | free | ✅ `SND-05` | EDT-01 |
| SND-06 | The Knock From Our Side | 📋 | free | — | EDT-01 |
| ENT-01 | Absolute Stillness | ✅ | free | — | CAM-01, FRM-03 |
| ENT-02 | The Slow Tilt | ✅ | free | — | CAM-08 |
| ENT-03 | Sub-Threshold Snap | ✅ | free | — | ENT-01 |
| ENT-04 | Appear in Darkness Only | ✅ | free | ✅ `ENT-04` | LGT-03, FRM-07 |
| ENT-05 | Wrong Proportions | 🔧 | free | — | ENT-01 |
| ENT-06 | Feet Facing Forward | 📋 | low | — | CAM-09 |
| ENT-07 | Delayed, Unnatural Movement | 📋 | low | — | CAM-02, CAM-13 |
| FAM-01..03 | Familiar becomes wrong | 🔧/📋 | free | — | SND-02 |
| INT-01..03 | Choice design | ✅/🔧 | free | — | INT-02 echoes |
| REL-01..02 | Reels hooks | 📋 | — | — | — |

---

## CAM — Camera

### CAM-01 · The Patient Push ✅
**Effect:** a slow dolly toward something that isn't doing anything. The viewer feels drawn in against their will, and the stillness of the subject becomes the threat.
**Use when:** approaching a figure, a doorway, or a dark gap. It works best for 8–20 seconds.
**Avoid:** pushing toward something that then jumps. That cashes in the dread too cheaply.
**Build:** shot `type: "slow_push"` with `from`/`to` and a small `lookAtTo` drift. Preset ease `sine.inOut`, with a tiny breathing drift.
**Used in:** `crossing_prototype` (push to the barrier while she stands under the lamp); `p1_road` (as a POV walk).

### CAM-02 · The Camera That Won't Turn 🔧
**Effect:** a character turns toward a sound and the camera refuses to follow. We keep watching the thing he isn't looking at, or we never see the source at all. The audience feels abandoned by the frame.
**Use when:** a sound comes from behind someone, or footsteps match his (Scene 3B), or he turns while she stays in frame (Scene 5).
**Build:** a `static` shot held through the character's turn. The sound gets a spatial `position` off-screen.

### CAM-03 · The Ground-Level Witness ✅
**Effect:** a camera about 20 cm off the ground feels like something low and unseen is watching. Wet ground and puddle reflections fill the frame.
**Use when:** openings, roads, approaching vehicles, children's perspective.
**Build:** shot `type: "low_angle"`, `from[1]` between 0.15 and 0.3, looking slightly up. Portrait needs a wider `fovPortrait` (≈52).
**Used in:** `crossing_prototype` shot 1.

### CAM-04 · Security-Camera Indifference 📋
**Effect:** a high, fixed, wide, slightly distorted frame. It feels like evidence, not storytelling. Something can happen at the edge of the frame and nobody reacts.
**Use when:** recaps, "found footage" interludes, the bus stop.
**Build:** `type: "security"` (static, wide FOV). 📋 Needs a PostFX variant: barrel distortion, desaturated green tint, timestamp overlay with frame drops.

### CAM-05 · The Slow Pan to the Wrong Thing 🔧
**Effect:** the camera drifts away from the character toward something the viewer wishes it hadn't found, like the mirror (Scene 2) or the fourth shadow.
**Use when:** the reveal is spatial, meaning it's already in the room.
**Build:** `type: "pan"` with a fixed `from` and `lookAt` → `lookAtTo`. Keep the pan slower than feels natural (≥4s for 30°).

### CAM-06 · Over-the-Shoulder Displacement 🔧
**Effect:** start over his shoulder, then let the camera drift a little *behind* him, as if someone else were standing where we are.
**Build:** `over_shoulder` whose `to` sits 0.3–0.5 m further back and slightly lower than `from`.

### CAM-07 · First-Person Breath 🔧
**Effect:** the viewer becomes Aarav, with a gentle breathing bob. Use it rarely so it stays shocking.
**Avoid:** more than once an episode.
**Build:** `first_person` preset (drift 0.018).

### CAM-08 · The Long Hold 🔧
**Effect:** the shot runs past the point where a normal film would cut. Discomfort comes from the edit not arriving.
**Use when:** after a line of dialogue lands, or after a door finishes opening.
**Build:** add a `static` shot 2–4s long after the action. Also see the end hold in `crossing_prototype`.

### CAM-09 · Descent to the Feet 📋
**Effect:** the camera tilts down, slowly and inevitably, toward a detail the viewer already suspects. Used **once**, for the reversed feet (Scene 5).
**Build:** `focus` shot from head height to 0.2 m, `lookAt` lowered to the floor. 📋 The Entity needs a close-up foot model (toes, nails, wet skin) for this shot.

### CAM-10 · Dutch Angle 🔧
**Effect:** a slight roll of the horizon. The world is no longer level, and the viewer feels it before noticing it.
**Use when:** after a revelation, during impossible transitions, or when Aarav's memory is failing. Roll *into* it slowly with `rollTo`; a sudden tilt reads as music video.
**Avoid:** more than two per episode; never on her establishing shots (her shots stay rigidly level, which makes her the stable thing).
**Build:** shot `roll` / `rollTo` in radians, ≤ 0.12.
**Cost:** free. **Combines with:** EDT-06, FRM-10.

### CAM-11 · Focus Pull 📋
**Effect:** focus shifts from the foreground subject to something in the background the viewer hadn't registered.
**Build:** 📋 `DepthOfField` in PostFX with a `focus` cue (target distance, duration). Disable on low quality and fall back to FRM-04 staging with light instead.
**Cost:** high (extra full-screen pass). **Combines with:** FRM-04, CAM-13.

### CAM-12 · Camera Obstruction 🔧
**Effect:** during a lateral track, a trunk, pole or door frame passes across the lens and blacks out the frame for a moment. When the frame clears, something has changed, or nearly has.
**Build:** `track_lateral` shot past a foreground object 0.5–1.5 m from the lens, with a cue timed to the occlusion.
**Cost:** free. **Combines with:** FRM-08, FRM-07, LGT-03 (the obstruction stands in for the flicker).

### CAM-13 · Reverse Reveal 🔧
**Effect:** we've watched the scene from one side; the reverse angle reveals she was standing behind the camera all along.
**Build:** a cut (or a 160–180° pan) to a reverse `static` shot with the entity cue placed *before* the cut, so she was "always there".
**Cost:** free. **Combines with:** CAM-02, ENT-04.

---

## FRM — Framing and composition

### FRM-01 · Negative Space Bait ✅
**Effect:** leave a dark, empty region big enough for a person. The viewer searches it every second it stays on screen.
**Use when:** every interior. Every doorway.
**Build:** an unlit doorway mesh (`meshBasicMaterial #020202`), framed in a third of the shot. See the GateCabin door.
**Used in:** the gate-cabin doorway (no one is in it yet; the payoff can come in a later episode).

### FRM-02 · Under the Line ✅
**Effect:** the figure stands just past a horizontal barrier (a boom, a threshold, the edge of a puddle). The line says "you can't cross", and she's already on the other side.
**Build:** compose the entity directly beneath a lowered boom or lintel.
**Used in:** `crossing_prototype` (she stands beneath the far boom).

### FRM-03 · Dead-Centre Symmetry ✅
**Effect:** a perfectly centred, still figure feels deliberate and inhuman. Use it for the entity only, never for Aarav.
**Used in:** `crossing_prototype` portrait.

### FRM-04 · Background Figure, Foreground Ignorance 🔧
**Effect:** Aarav in the foreground, unaware. She stands in the deep background, small and in soft focus. The viewer knows; he doesn't.
**Build:** two-plane composition. 📋 Depth of field (PostFX `DepthOfField`) is needed to sell it fully.

### FRM-05 · The Reflection Gap 📋
**Effect:** the mirror shows something the room doesn't, or misses something the room has. (Scene 2 woman; Scene 3C reflection smiling.)
**Build:** 📋 a `Mirror` component: a render-target camera reflected across the mirror plane, with a per-mirror `layers` mask. Entities can be put on a "reflection only" layer, and a separate reflected Aarav can be posed independently (the smile).

### FRM-06 · Photograph Wrongness 📋
**Effect:** a static image that should be safe isn't: a scratched face, an extra shadow.
**Build:** 📋 a canvas-generated photo texture (sepia, grain, people drawn as silhouettes from a fixed family pose). The extra shadow is a second layer whose opacity a cue drives.

### FRM-07 · Peripheral Apparition 🔧
**Effect:** she appears at the edge of the frame for under 1.5 s while the viewer's attention is on the centre. Half the audience will see her; the other half will hear about it in the comments.
**Use when:** mid-scene, never at a shot's start. Keep her outside the caption area and inside the portrait-safe width.
**Build:** the `ENT-04` macro to place her, then `LGT-03` to remove her, with the position at the frame edge. Check in portrait: the 9:16 frame is narrow, so "edge" is about 1.2 m off-axis at 8 m.
**Cost:** free. **Combines with:** CAM-12, EDT-03.

### FRM-08 · Occlusion Reveal 🔧
**Effect:** trees, door frames or a wall hide part of the frame; as the camera moves past, the hidden figure is revealed.
**Build:** slow `track_lateral` with the entity placed behind a trunk or wall edge from the camera's start position (check the sightline in the browser).
**Cost:** free. **Combines with:** CAM-12, ENT-04.

### FRM-09 · Frame-within-Frame 🔧
**Effect:** doorways, window bars and barrier posts box the subject in. The viewer feels trapped with them.
**Build:** composition only; place the camera so architecture frames the subject on at least two sides.
**Cost:** free. **Combines with:** FRM-01, CAM-08.

### FRM-10 · Asymmetric Composition 🔧
**Effect:** Aarav is pinned to one edge with a heavy empty mass on the other. The frame feels unbalanced, as if waiting for something to fill it.
**Build:** composition; reserve the empty side for later payoff (FRM-01).
**Cost:** free. **Combines with:** FRM-01, CAM-10.

---

## LGT — Light

### LGT-01 · Sodium Backlight Silhouette ✅
**Effect:** an orange street lamp behind the subject turns her into a cut-out, readable but faceless. Wet hair catches the light at the edge.
**Build:** a spot behind and above the entity, aimed toward the camera, with `castShadow` so her shadow reaches toward us, a `beam` volumetric cone, and fog sheets lit by `glowPos`.
**Used in:** `crossing_prototype`.

### LGT-02 · The Dying Tube ✅
**Effect:** a failing tube light. Starter-click stutters, then it holds, with the odd dropout. It's the sound and light of every neglected Indian government building.
**Build:** `FlickeringLight` with `mode: "dying"`, `bulb="tube"`, `hum="hum"`. The ballast hum follows the light's level.
**Used in:** gate cabin (`gate_tube`).

### LGT-03 · Flicker Displacement 🔧
**Effect:** when the light drops out, the world changes. She's gone, or closer, or the photograph has turned. Viewers aren't sure they saw the change.
**Rule:** the change must happen *during* darkness, so the cue lands inside the flicker window.
**Build:** the `LGT-03` macro, or by hand: a light cue with `mode: "flicker"` at T, the entity/prop cue at T+0.3 to T+0.5, then `mode: "on"` at T+0.9.
**Used in:** `crossing_prototype` end (she vanishes in the sodium flicker).

### LGT-04 · One Frame Closer 📋
**Effect:** for a single frame during a flicker, she's a metre closer. The viewer can't be sure. (Scene 5.)
**Build:** 📋 needs frame-exact cues: an `entity` cue with `durationFrames: 1`. Live playback can't guarantee one frame at variable fps, so use ~50 ms in live playback and exactly one frame in Reel export.

### LGT-05 · Lit Room, Dark Doorway 🔧
**Effect:** a readable room around a doorway that stays completely black. You can see everything except the one place that matters.
**Build:** light the room. Make the doorway an unlit black plane or deep geometry. Keep lights out of it with `distance` falloff.

### LGT-06 · The Candle Foreground 🔧
**Effect:** a flame in the foreground, the character soft behind it. Warm, intimate, fragile. (Scene 6.)
**Build:** a small point light with a fast seeded flicker, plus an emissive flame sprite near the camera.

### LGT-07 · Light Avoids Her 📋
**Effect:** lamps dim or buzz as she gets close. Over the episode, viewers learn that light reacts to her.
**Build:** 📋 FlickeringLight reads the entity positions in the store and drops its level by distance.

### LGT-08 · Delayed Environmental Reaction 🔧
**Effect:** the world reacts to her a beat *late*: the tube dies 0.8 s after the motif, a dog stops barking a second after she appears. Viewers learn to read the environment as a warning system.
**Build:** an ordinary light/ambience cue placed 0.5–1.5 s after an `ENT-04` macro.
**Cost:** free. **Combines with:** ENT-04, LGT-07.

---

## EDT — Editing and time

### EDT-01 · Cut to Silence ✅ (design) / 🔧 (scene)
**Effect:** at the loudest moment (the train horn), cut to black *and* total silence. The absence hits harder than any stinger.
**Build:** a `fade` cue to 1 with `duration: 0.01`, and `ambience` cues setting every bed to 0 with `fade: 0`.

### EDT-02 · Delayed Reveal Cut 🔧
**Effect:** something falls behind the counter, and we stay on his face. The cut to what fell never comes, or comes very late.

### EDT-03 · Continuity Error on Purpose 🔧
**Effect:** after a cut, one detail has changed: his shoes are wet but the track is dry, the photo is turned to the wall. Viewers question their own memory, which is the theme of the show.
**Rule:** exactly one changed detail per instance. Never explain it.

### EDT-04 · The Restrained Title ✅
**Effect:** the title doesn't announce itself. It fades in over a scene that's already dying.
**Build:** a `title` cue, a 3.5s CSS fade, and a `fade` to 0.6 underneath.

### EDT-05 · False Reveal 🔧
**Effect:** build toward a reveal and deliver something harmless (a coat on a hook, a goat in the dark). The viewer relaxes, and the real wrongness is already in another part of the frame.
**Rule:** the real threat must be visible in the false-reveal shot itself, so a rewatch rewards the viewer.
**Cost:** free. **Combines with:** FRM-07, EDT-03.

### EDT-06 · Impossible Spatial Transition 📋
**Effect:** space stops obeying rules. The corridor is longer than the house, or a cut from the bedroom lands on the crossing with the camera still mid-move.
**Build:** 📋 two options. (a) A `stretch` cue that scales corridor geometry along its axis during a push. (b) A match-move cut: the next scene's first shot continues the previous shot's exact camera velocity.
**Cost:** low. **Combines with:** CAM-10, EDT-03.

---

## SND — Sound

### SND-01 · The Three-Note Motif ✅
**Effect:** three soft bell tones, E5–C5–B♭4, with the last one sagging flat. The first time it sounds like a distant railway signal. By the end, viewers know it means *she is here*. Use it every time she appears, never when she doesn't, and never loud.
**Build:** sfx `signal`, spatial, positioned far away (≥30 m). Volume ≤ 0.3.
**Used in:** `crossing_prototype` at 12.5s.

### SND-02 · Voice Out of Its Source 📋
**Effect:** a familiar voice comes from something that can't speak: a disconnected radio, a wall, the far end of a corridor.
**Build:** 📋 recorded VO played as spatial `sfx` at the object's position, run through a radio band-pass. Needs a `voice` sound category with per-line files (see `docs/pipeline.md`).

### SND-03 · Rhythm Matching 📋
**Effect:** footsteps that match his exactly, then stop a fraction late. (Scene 3B.)
**Build:** 📋 a footstep sfx sequencer that takes a rhythm array and offset. The "other" steps are delayed 40 ms and play from behind the listener.

### SND-04 · Mains Hum Bed ✅
**Effect:** 50 Hz electrical hum (Indian mains) under a scene. It's unsettling without being noticed, and its absence is noticed.
**Build:** the `hum` loop is tied to a tube light.

### SND-05 · Pull the Rain 🔧
**Effect:** the rain bed fades out without the viewer noticing, until they suddenly notice it's quiet. (Ending A: "the rain stops.")
**Build:** an `ambience` cue setting `rain` to 0 with a `fade` of 8–12s.

### SND-06 · The Knock From Our Side 📋
**Effect:** the final three knocks seem to come from the viewer's own room. On headphones: centred, dry, close, with no reverb.
**Build:** 📋 a `knock` synth/recording played non-spatial, after the visuals have gone fully black.

---

## ENT — Entity behaviour

See `entity.md` for her rules. These are the tools.

### ENT-01 · Absolute Stillness ✅
**Effect:** she doesn't breathe, sway or shift weight. Every living thing moves; she doesn't.
**Build:** the Entity has no idle animation by design.

### ENT-02 · The Slow Tilt ✅
**Effect:** her head tilts slowly by a few degrees. It's curiosity, not aggression.
**Build:** an `entity` cue with `tilt` (radians, ≤0.2). It's lerped very slowly.

### ENT-03 · The Sub-Threshold Snap ✅
**Effect:** every few seconds the head snaps about 1° and holds. Most viewers won't consciously see it; they'll just feel it.
**Build:** built into Entity (seeded by `clock.t`).

### ENT-04 · Appear in Darkness Only ✅
**Effect:** she never fades in on camera. She is simply there after a dark beat, or was always there and the light found her.
**Build:** the `entity` visible cue lands while the light is off, or at the scene cut.

### ENT-05 · Wrong Proportions 🔧
**Effect:** a little too tall, arms a little too long. Nobody can say why she looks wrong.
**Build:** Entity height 1.84 m, hands about 10 cm too low. Don't exaggerate.

### ENT-06 · Feet Facing Forward 📋
**Effect:** in Ending C her feet face forward, the "correct" way. That's the most disturbing image in the episode, because something has been *fixed* by taking Aarav.
**Build:** 📋 an Entity prop `feet: "reversed" | "forward"`.

### ENT-07 · Delayed, Unnatural Movement 📋
**Effect:** she only moves when the camera isn't looking, or her head turns before her body. When we do see motion, it lags a fraction too long behind its cause.
**Build:** 📋 an Entity prop for a pose change that applies only while she's outside the camera frustum, plus head-first rotation with a 0.3 s body lag.
**Cost:** low. **Combines with:** CAM-02, CAM-13.

---

## FAM — Familiar becomes wrong

### FAM-01 · The Childhood Nickname 🔧
**Effect:** "Bhaiya" in a voice nobody has used in seventeen years. Use it sparingly: each "Bhaiya" should land harder than the last.

### FAM-02 · One Missing Object 📋
**Effect:** a room exactly like his memory, except one object is gone (the wooden horse).

### FAM-03 · Unnatural Timing in a Natural Voice 📋
**Effect:** the right voice with the wrong rhythm: pauses too long, or a reply before the question ends.
**Build:** 📋 VO editing rule. Leave a 1.5–3s gap before replies that "shouldn't" know the answer.

---

## INT — Interactive (choices)

### INT-01 · Choice as Held Breath ✅
**Effect:** the world doesn't freeze while you choose. Rain keeps falling, the light keeps flickering, the camera holds. Choosing feels like doing something *in* the scene.
**Build:** the scene clock keeps running during the `choice` phase. The last line stays on screen; options fade in one at a time.

### INT-02 · Consequence Echo ✅
**Effect:** a later scene quietly remembers your earlier choice with one line, not a new branch. It's cheap to build, and players feel seen.
**Build:** Ink conditionals on flags (`{entered_bedroom: …}`).
**Used in:** Scene 4 opening line, Scene 5 extra WOMAN line, ending variants.

### INT-03 · No Safe Option 🔧
**Effect:** every choice is reasonable, and every one costs something. Never offer an obviously correct answer.

---

## REL — Reels (Instagram cutdowns)

### REL-01 · Cold Open on the Wrongness 📋
**Effect:** the first 1.5s of a Reel must show the wrong detail (her under the lamp, the reflection) before the viewer scrolls away. Then cut back to the start.

### REL-02 · End on the Decision 📋
**Effect:** the Reel ends on the narrated choice prompt, then the options shown as a still title card: "What would you do?" The link opens the website at that knot.
**Build:** 📋 the Reel export pipeline (`docs/pipeline.md`), with `?start=<knot>` deep links.
