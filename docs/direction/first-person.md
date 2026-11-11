# First-Person Storytelling (Phase 11)

> ⚠️ **Superseded for camera language by decision #26 (cinematic, not FPS).** The player still *decides* as Aarav and the narrator still says "you", but the camera films Aarav like a horror movie. First-person is a rare insert. The rest of this doc (narrator, choices as part of the world, Ink/director separation) still applies.

**THE PLAYER IS THE PROTAGONIST.** You are Aarav. The narrator tells you what you hear and asks what you'll do: *"You hear the anklets approaching from behind the door. Will you open it, or will you run?"* The visuals must make you feel you are the one deciding.

## Camera modes

| Mode | What it is | Shot types | Status |
|---|---|---|---|
| **1. PLAYER POV** | Pure first person. The player controls the look (drag on mobile, mouse on desktop). | — | 📋 (drag-to-look, clamped yaw/pitch, during choices and gameplay segments) |
| **2. CINEMATIC POV** | Attached to your eyes, but scripted: walking bob, involuntary head turns, leaning in. **The default.** | `pov_walk`, `first_person`, `pan` at eye height (1.62 m) | ✅ |
| **3. DIRECTOR SHOT** | A composed external camera, used only when showing your body adds horror (your shoulder plus her behind you). **Rare.** Never during an important decision. | any external shot | ✅ (the existing shot system) |

Recording captures all three.

## Physical presence (no floating camera)

| Element | Status |
|---|---|
| **Your shadow:** an invisible body that casts a real shadow (it falls ahead of you when a lamp is behind you) | ✅ `PlayerShadow` |
| Breathing and walk bob in the camera; fear is shown by breath and a *small* instability, never shake | ✅ presets (`pov_walk`, `first_person`) |
| Involuntary head turn toward a sound (a fast start, a slow settle) | ✅ two-part pan shots |
| Hands and forearms reaching for a door or object, holding the flashlight; clothing and feet when looking down | 📋 procedural low-poly arms first (no rigging), with a GLB upgrade later |
| Reflections of you in mirrors | 📋 FRM-05 mirror system |
| Leaning toward edges and doorways | 🔧 slow push with a slight pitch |

## Semi-first-person deviations (allowed, rare)

- **Over-the-shoulder shadow:** a quick director shot shows your shoulder and her behind you, then back to POV, and she's gone.
- **The reflection:** you look at the mirror. You're fine; the room behind you isn't.
- **The player's shadow:** your shadow moves on its own, and the camera doesn't cut away. ✅ Part 1 variant: a *second* shadow beside yours.
- **The impossible POV:** the room through the door is deeper than the house.

## Choices are part of the world

- A choice can carry a **direction tag**: `* [Cross the tracks # dir: ahead]`. Options render in the matching screen region (ahead = upper centre, behind = lower centre, left, right) with a quiet glyph, so a choice feels like a direction in the space rather than a button. ✅
- Later: an object to touch, a light in one direction and darkness in the other, a hand hovering.
- **Always readable and accessible:** large touch targets, real buttons, keyboard focus. Cinematic never beats usable.
- The world keeps moving while you choose (INT-01).

## The camera reacts to the decision
Each choice leads into its own scene config, so the camera, light and audio differ by choice. Entering a dark room means pushing toward the door and the light changing. Running means bob and breath intensify and the frame is less stable. Trusting her means the camera stays on her and her behaviour changes. The scene receives the story state through Ink flags and conditional lines, and through a separate scene per branch.

## The narrator

- A **storyteller**, not a dialogue box. Second person, present tense, short sentences. Captions are italic with no speaker label.
- Supports timed lines (`# at`), pauses (gaps between `at`s), silence (lines held back while the camera holds), whispers (📋 a `# voice: whisper` style once there's VO), and state-dependent lines (Ink conditionals).
- **The narrator controls timing.** "You hear something behind you." Pause. The camera stays still. "Something that sounds like your own footsteps." Then the second footsteps start. **The camera doesn't turn by itself. The player has to decide whether to look.**
- Sometimes the narrator asks for something **psychologically uncomfortable**, not a path: *"You know she is waiting for you to look at her face. Will you?"*
- Who the narrator *is* stays an open canon question (`docs/bible/story.md`).

## Architecture contract
A cinematic receives: the story node (scene id), the decision (branch knot → its own scene), previous decisions (Ink flags → conditional lines and branch routing), entity state (store), environment state (light modes), camera mode (shot type), narration timing (`# at/hold`), and choice availability (Ink). There are no monolithic cinematic components: everything is the same reusable sets plus per-scene JSON.

## Implementation priority
One complete vertical slice before anything else: you approach the crossing, the woman appears, the narrator speaks, an anomaly, two choices, the world reacts, a transition. It must work as cinematic POV, and later as player POV, in 9:16. → **Part 1 "The Crossing"** is this slice.
