# Gameplay Horror (Phase 12)

The world has to support real horror-game events (fear, danger, pursuit, physical interaction, failure, death) in first person, at the quality of a professionally made horror game. We do it with our R3F stack, procedural geometry, shaders, and (licensed, optimised) GLB assets. No Blender.

## Systems and status

| System | Requirement | Status |
|---|---|---|
| **First-person body** | Hands and arms, flashlight, holding objects, door opening, fear reactions, breathing, recoil, shadow, reflection, damage reaction | Shadow ✅ · breathing/bob ✅ · arms 📋 |
| **Flashlight** | A cone light from the hand that's battery-honest, flickers when she's near (LGT-07), sweeps with the look | 📋 next |
| **Weapons** | Rural, not a shooter: torch, lathi (stick), iron rod, axe, sickle; ritual objects. Idle, inspect, equip, attack, impact, audio. **Weapons don't make you safe.** The woman is unaffected by them, and some encounters need hiding, running or a decision instead. | 📋 (one defensive item first: a lathi or iron rod) |
| **Jumpscare framework** | Every scare has setup, trigger, camera behaviour, entity animation, audio, light, impact, duration, recovery and story consequence. It's the *payoff* of a constructed sequence, never random. | ✅ first instance: the Part 1 capture (`p1_look`) |
| **Chase** | Detection → chase → player movement → distance-based audio → camera instability → obstacles and hiding places → escape or capture conditions → branching | 📋 needs a *different* entity (see conflicts) and a PLAYER POV mode |
| **Capture** | A cinematic of being caught, **different for each entity** (pulled into darkness, head grabbed, engulfed by shadow, approach without moving limbs, appearing through a reflection) | ✅ the woman's capture = *proximity* (`p1_look`) |
| **Death** | Physical, supernatural, falling, or **narrative death** (the narrator keeps speaking as the world disappears) | ✅ narrative death (`p1_cross`) |
| **YOU DIED screen** | Black, atmospheric, slowly emerging distorted type, the narrator's epitaph, minimal options **driven by the narrative architecture** | ✅ |

## Three outcomes that must feel different

| State | Meaning | How Ink marks it | What the player gets |
|---|---|---|---|
| **Wrong decision** | A consequence: the story continues, worse off | Flags, then later scenes change | Nothing explicit. You find out later. |
| **CAPTURED** | An entity physically has you. Outcome: death, escape, captivity, lost item, new branch, transformation | `# captured` on a line | The capture cinematic → the story continues on Ink's chosen branch (Part 1: you lose the cassette and wake on the verandah) |
| **DEAD** | This path is over | `# dead` on the epitaph line, then `-> END` | The YOU DIED screen. **Return to the last decision** (checkpoint), **Start again**. Only options the architecture supports are shown. |

Checkpoints are automatic: the story state is saved before every beat that ends in a choice. "Return to the last decision" replays that beat from its start, so you re-live the tension.

## Jumpscare rules
- One loud moment per chapter (`docs/cinematics/horror-techniques.md`). The Part 1 capture spends it, and only on the branch where you *chose* to look.
- Use false jumpscares (a branch moves, nothing happens, then the real thing behind you).
- Brief examples kept for later: **The Face** (a face at the window, very close), **The Ceiling** (a different entity), **The Reflection Lunge** (the mirror's reflection moves on its own).
- No bloodied beds or gore splashes (visual signature). Implication over gore.

## Graphics bar
PBR materials, realistic light and shadows, fog, wet surfaces, realistic characters and scale, controlled exposure, strong silhouettes. No primitive-looking characters, cheap faces, flat light, cartoon animation, or repeated geometry. See `docs/world/visual-quality.md`.

## Reels compatibility
Jumpscares, chases, captures, deaths, weapon moments and decisions must all read in 9:16 from the first-person view. Don't automatically switch to third person.

## Build order (vertical slice)
1. First-person presence ✅ (shadow, bob, breathing) → 2. Flashlight → 3. One defensive weapon → 4. One hostile entity → 5. Detection → 6. Chase → 7. One jumpscare ✅ → 8. One capture ✅ → 9. One death ✅ → 10. YOU DIED ✅ → 11. Ink integration ✅ → 12. Vertical recording 📋.
Items 2–6 need the **PLAYER POV** camera mode and a design for the hostile entity first. Ask the team before inventing a second entity: it's a canon decision.
