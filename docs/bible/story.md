# Story Bible

The canon. If a script or scene contradicts this, one of them is wrong; settle it in `docs/decisions.md`.

## Premise

A cassette arrives with no sender. It holds the voice of Aarav's younger sister, Meera, who disappeared seventeen years ago. On it she says something she never said while she was alive: *"Bhaiya… you left me outside."* Aarav goes back to his childhood village during a monsoon night. The road there seems to remember what he has forgotten.

The horror comes from guilt, memory, being watched, voices you know, and the possibility that a choice made long ago caused someone's suffering. It doesn't come from a monster.

## Folklore stance

The show draws on **chudail** motifs, including the reversed feet, but traditions vary by region and there is no single canonical legend. Ours is an original story. The reversed feet are a quiet *clue*, not a definition. She is never a disposable monster: she has a history, a motive, and a connection to the central mystery. "Chudail" is what the village called her. It isn't her name.

## Timeline

| When | What |
|---|---|
| Before 1992 | A young woman, "the girl from the crossing", lives near (or at) LC Gate 47. Her history is **open**: who she was, and what the village did to her. Episode 2+ material. |
| 17 Aug 1992, monsoon night | She comes to the house asking for shelter. Aarav's mother turns her away. She cries outside. Aarav (14) hears it. **Meera (8) opens the door and goes with her. Aarav watches and doesn't stop her.** Their mother tells everyone Meera ran away. Meera never left the village. |
| 1992–2009 | Aarav leaves the village. His memory of that night stops at opening the door. |
| 2009, monsoon, ~2:17 AM | Present day of Episode 1. The cassette is labelled "MEERA — 17/08/1992". |

## Point of view (canon since 2026-11-08, decision #21)

**The player is Aarav.** A narrator speaks to the player in **second person, present tense** ("You have not been back in seventeen years."). Aarav's spoken lines are the player's own and show as "You". The narrator is a separate storyteller, not Aarav's inner voice.

## Characters

**Aarav (you).** 31 in 2009. He comes back after seventeen years. Quiet and controlled, and in denial without knowing it. His narration is calm and literary. His spoken lines are short, mostly Hindi. We **never show his face**: the camera is his eyes. He exists through his shadow, his breath, his footsteps (and later his hands).

**Meera.** 8 in 1992. She is heard (on the tape, the radio, the child's voice) and only seen once, at the end of Ending B, holding the wooden horse. She calls him "Bhaiya". Whether she is dead, held, or something else is **deliberately unresolved**.

**The woman ("the girl from the crossing").** See `entity.md`. Her name is unknown. "Before they forgot my name" is a promise the series must eventually keep.

**The mother.** Present only through her diary. She is guilty, but she is not a villain: she was afraid. Whether she is alive in 2009 is **open**.

**The driver.** Part 1 only. He knows not to stop on this road at night. If you ask, he gives you **the rule**: *"Phaatak ke paas agar koi naam lekar bulaaye… toh peeche mat mudna."* (If anyone calls your name near the gate, don't turn around.)

**The narrator.** Unnamed. Knows more than you. Never lies, but chooses what to leave out (they never mention that she moved closer). **Open:** who is telling this story? Proposal for discussion: the narrator *is the road* (the episode is "The Road That Remembers").

## Episode 1 — The Road That Remembers

Script: `src/story/episode-001.ink`. 74 paths (`npm run check`).

### Part 1 — The Crossing ✅ (built, playable)

| Beat | Scene | What happens |
|---|---|---|
| 0 | `p1_car` (animatic) | 2:17 AM, the taxi. Choice: **ask the driver** (`heard_rule`, you learn the rule) or **get out silently**. |
| 1 | `p1_road` | POV walk to LC Gate 47. She's already beyond the crossing. You glance at the gatekeeper's open door; when you look back she is **at the barrier**, and the narrator doesn't mention it. "Bhaiya?" in Meera's exact voice. Choice: **cross the tracks** or **turn back**. |
| 2a | `p1_cross` | You step onto the humming rails; she's gone; a horn; black and silence. **DEAD**: "Some voices should never be followed." |
| 2b | `p1_turn` | You turn back. The lamp throws your shadow up the road, and a **second shadow** appears beside yours with anklets in step. You stop; it takes one more step. "Bhaiya… peeche dekho na." (The rule echoes if you heard it.) Choice: **look behind you** or **keep walking**. |
| 3a | `p1_look` | She's there, an arm's length away, for less than a second. **CAPTURED**: you wake at the tea stall and the cassette is gone (`captured_at_crossing`). |
| 3b | `p1_walk_on` | The second shadow passes yours and goes on ahead toward the tea stall. |

Design intent: the rule from choice 0 is what saves you at choice 2, so curiosity is rewarded. Crossing to the voice kills you; looking back costs you the cassette.

### Part 2+ (draft, converted to second person, needs a continuity pass)
The rest is the original 7-scene outline, rerouted through Part 1.

| Decision | Options → flag |
|---|---|
| 1. Tea stall | follow the crossing → `followed_crossing` · return home → `returned_home` · replay the cassette → `replayed_cassette` |
| 2. Corridor | enter the bedroom → `entered_bedroom` · examine the photo → `examined_photo` · call Meera → `called_meera` |
| 3. The diary | burn → Ending A *The Forgetting* · read the last page → Ending B *The Remembering* (`remembered_truth`) · go to the crossing → Ending C *The Return* |

How earlier flags show up later (INT-02):
- `heard_rule`: the narrator repeats the driver's rule at the look-behind choice.
- `captured_at_crossing`: the cassette reappears on the tea-stall counter; the woman says "You looked at me"; Ending C callback.
- Scene 4 opening line: one of three, chosen by decision 1.
- Scene 5: the woman adds a line that depends on decision 2.
- Ending A: `replayed_cassette` adds Meera's line after the knocks.
- Ending B: `entered_bedroom` decides whether Meera holds the horse or looks at her empty hands.
- Ending C: `followed_crossing` brings the footprints back onto the track.

## Open questions (for Episode 2+)

- The woman's name and what happened to her before 1992.
- Who the narrator is (see Characters).
- Who sent the cassette. (Candidates: the mother, Meera, the woman, Aarav himself.)
- What "she is still waiting" means for Meera.
- Ending C leaves the woman on the near side with her feet facing forward. Did they swap places?
- Which ending is canon going into Episode 2? (Proposal: none. Episode 2 opens with a state that's consistent with all three.)

## Tone rules

- Nobody explains the supernatural. Characters speak in fragments.
- Hindi lines stay in Hindi (romanised on screen). Narration is in English. Don't add translations under Hindi lines whose meaning is clear from context.
- No comic relief. No villain monologues.
