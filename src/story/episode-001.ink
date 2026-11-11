// KAALI RAAT — Episode 1: THE ROAD THAT REMEMBERS
// Format rules: docs/script-format.md. Story canon: docs/bible/story.md. Direction: docs/direction/.
//
// YOU are Aarav. The narrator is a storyteller speaking to you: second person, present tense.
//
//   Unprefixed text      -> narration (italic, no label)
//   NAME: text           -> dialogue (AARAV shows as "You"; DRIVER, MEERA, WOMAN, CHILD, DIARY)
//   // comment           -> stage direction for directors; never shown
//   # scene: id          -> cut to scene `id` (src/scenes/<folder>/<id>.json). Unbuilt scenes play as black animatic.
//   # at: s / # hold: s  -> timing on the scene clock (optional)
//   # captured           -> an entity has you; the story continues on this branch
//   # dead               -> this line is the epitaph; the path ends (YOU DIED screen)
//   * [Choice # dir: ahead|behind|left|right]  -> where the option sits on screen, as a direction in the world

VAR heard_rule = false
VAR captured_at_crossing = false
VAR followed_crossing = false
VAR returned_home = false
VAR replayed_cassette = false
VAR entered_bedroom = false
VAR examined_photo = false
VAR called_meera = false
VAR remembered_truth = false
VAR ending = ""

-> part1

// ─────────────────────────────────────────────────────────── PROTOTYPE
// Dev cinematic for the railway-crossing environment. Open with ?start=prototype
=== prototype ===
Seventeen years ago, you left this village believing you had forgotten everything. # scene: crossing_prototype # at: 4.5 # hold: 4.5
Tonight, someone sent you a memory. # at: 14 # hold: 3.5
-> END

// ═══════════════════════════════════════════════════════════ PART 1 — THE CROSSING
// Vertical slice for docs/direction/first-person.md. Three decisions; all three outcome kinds:
// DEAD (cross the tracks), CAPTURED (look behind you), SAFE (keep walking). The driver's rule (choice 0)
// is the knowledge that saves you at choice 2 — if you asked.
// Reels moments: "the figure in the distance" (p1_road), "the second shadow" (p1_turn / p1_walk_on).

=== part1 ===
// p1_car — FILM. Low on the wet road: one pair of headlights comes out of the rain and stops short of us.
// Inside: Aarav in the passenger seat, dashboard glow, the crossing far ahead through the windscreen.
It is 2:17 in the morning. # scene: p1_car # at: 3 # hold: 3
You have not been back to Sonpahari in seventeen years. # at: 6.4 # hold: 3.6
In your hand, a cassette nobody should have been able to send you. On the label: MEERA — 17/08/1992. # at: 10.4 # hold: 4.6
Meera was eight when she disappeared. # at: 15.4 # hold: 3
DRIVER: Yahin utarna hai? # at: 19.2 # hold: 2.6
* [Ask why he won't drive any further] -> ask_driver
* [Get out without a word] -> get_out

= ask_driver
~ heard_rule = true
AARAV: Aage kyun nahi chaloge? # scene: p1_car_talk
DRIVER: Raat mein is raste par koi nahi rukta.
// He doesn't look at you. He looks at the road, at the gate, and away.
DRIVER: Phaatak ke paas agar koi naam lekar bulaaye… toh peeche mat mudna.
If anyone calls your name near the gate, he says, don't turn around.
-> the_road

= get_out
You don't ask. Nobody in this village ever answered your questions. # scene: p1_car_talk
-> the_road

=== the_road ===
// p1_road — FILM coverage: wide on Aarav as the taxi reverses away; tracking behind him; his head turns to the cabin
// (insert of the open door); back over his shoulder — she is at the barrier now. Old note: You walk toward LC Gate 47. She is already there in the first frame, far, under the lamp (Reels HOOK).
// You glance at the gatekeeper's open door when the tube light ticks. When you look back she is at the barrier.
// The narrator NEVER mentions that she moved. The viewer notices; "you" don't. (FRM-07 / "figure in the distance")
The driver reverses all the way back up the road. He won't turn his back on the crossing. # scene: p1_road # at: 1.2 # hold: 4.2
Level Crossing 47. Nothing here has changed. # at: 6 # hold: 3.6
There is a woman beyond the crossing. # at: 10.2 # hold: 3.2
She is not waiting for a train. # at: 13.6 # hold: 2.6
The gatekeeper's door is open. It was always open. # at: 16.8 # hold: 3
MEERA: Bhaiya? # at: 23 # hold: 2.4
Nobody has called you that in seventeen years. # at: 25.8 # hold: 3.4
It is her voice. Not like her voice. Hers. # at: 29.4 # hold: 3.4
She is waiting for you to come to her. # at: 33.2 # hold: 3
* [Cross the tracks to her # dir: ahead] -> cross
* [Turn back toward the village # dir: behind] -> turn_back

= cross
~ followed_crossing = true
// p1_cross — POV walk to the rails. She vanishes in a sodium flicker (LGT-03). The rails hum. A horn, far left.
// At its loudest: cut to black and total silence (EDT-01). The narrator finishes the story without you. NARRATIVE DEATH.
You step past the broken barrier. # scene: p1_cross # at: 0.8 # hold: 3
She is gone. # at: 5.4 # hold: 2.6
The rails under your feet are humming. # at: 8.4 # hold: 3
They find the cassette on the tracks in the morning. # scene: p1_dawn # at: 1.5 # hold: 3.2
Still in its case. Still dry. # at: 5 # hold: 3
Some voices should never be followed. # dead
-> END

= turn_back
~ returned_home = true
// p1_turn — involuntary 180° turn (two-part pan). The tube light dies a beat late (LGT-08). The sodium lamp is behind
// you now: your shadow stretches up the wet road (PlayerShadow). Your footsteps; then anklets matching them.
// A second shadow appears beside yours — her body is not there (shadow-only entity). You stop. It takes one more step.
You turn your back on her. # scene: p1_turn # at: 3 # hold: 2.8
The lamp behind you throws your shadow far up the road. Toward the village. # at: 6.2 # hold: 3.8
Your footsteps. And with them, very faint, something else. # at: 10.6 # hold: 3.6
There are two shadows on the road. # at: 14.6 # hold: 2.8
Only one of them is yours. # at: 17.8 # hold: 2.8
MEERA: Bhaiya… peeche dekho na. # at: 21.2 # hold: 2.8
{
- heard_rule: If anyone calls you near the gate, the driver said. Don't turn around. # at: 24.4 # hold: 3.6
}
Something is standing right behind you. Close enough to touch. # at: 28.4 # hold: 3.2
* [Look behind you # dir: behind] -> look
* [Keep walking # dir: ahead] -> walk_on

= look
~ captured_at_crossing = true
_ # scene: p1_look
// p1_look — the one loud moment of Part 1, and only because you chose it. Fast involuntary turn: she is there,
// an arm's length away, hair over her face. capture_hit + sodium flicker, then EDT-01: black, silence.
// Her capture is PROXIMITY. She does not lunge (docs/bible/entity.md). CAPTURED, not dead.
// (p1_look ends on EDT-01 at 1.7 s; the aftermath plays over the empty road, not black.)
You see her for less than a second. # scene: p1_after # at: 1.2 # hold: 2.8
Long enough to understand that she has been standing behind you since the car stopped. # at: 4.4 # hold: 4.2
You wake on the bench of the old tea stall by the road. # at: 9.2 # hold: 3.4 # captured
It is still raining. The cassette is gone. # at: 13.2 # hold: 3
-> part1_end

= walk_on
// p1_walk_on — POV walk on. The second shadow keeps pace, then passes yours and goes on ahead, anklets with it.
You keep walking. You don't look back. # scene: p1_walk_on # at: 1.2 # hold: 3
The second shadow keeps pace with yours. # at: 5 # hold: 3.4
Then it walks past you. Ahead of you. Toward the village. # at: 9.8 # hold: 3.6
Toward the only light still burning on this road: the old tea stall. # at: 14.4 # hold: 4.2
-> part1_end

=== part1_end ===
// p1_end — crane up off the empty road; the crossing small in the rain; title. Part 2 picks up at the tea stall.
The road remembers you now. # scene: p1_end # at: 2 # hold: 4
-> END

// ═══════════════════════════════════════════════════════════ PART 2+ — DRAFT
// Converted to second person; still needs a full pass for Part 1 continuity (docs/bible/story.md → "Part 2 rewrite").

// ─────────────────────────────────────────────────────────── SCENE 2
=== tea_stall ===
// One flickering tube light. A disconnected radio. A dusty mirror.
{
- captured_at_crossing: Your cassette is on the counter. You don't remember putting it there. # scene: tea_stall
- else: You set the cassette down on the counter. # scene: tea_stall
}
// The disconnected radio wakes: static.
MEERA: Bhaiya?
AARAV: Meera?
// Silence. Something falls behind the counter. We stay on your reaction.
The same voice. Coming out of a radio that isn't plugged in.
// Slow pan to the mirror: a woman stands behind you. Hold 2s — the viewer sees her first. Flicker. Gone.
-> first_decision

// ─────────────────────────────────────────────────────────── SCENE 3
=== first_decision ===
// The cassette is playing now. Clearer.
MEERA: Bhaiya… don't come home. # scene: tea_stall_tape
AARAV: Where are you?
MEERA: You're already here.
// Three knocks. Not the door. Inside the wall. Static camera.
Some memories are better left buried.
But if you leave now, you will never know what happened to her.
* [Go to the house # dir: ahead] -> go_home
* [Play the cassette again # dir: left] -> replay_cassette

= go_home
// Camera behind... (POV): a second set of footsteps — if you saw the shadow, you know whose.
Someone has left a light on for you. # scene: road_footsteps
-> childhood_house

= replay_cassette
~ replayed_cassette = true
MEERA: Bhaiya… don't come home. # scene: tea_stall_mirror
MEERA: She's standing behind you.
// Slow move to the mirror. The mirror is empty.
MEERA: Don't look at her.
// Your reflection begins to smile. You do not.
-> childhood_house

// ─────────────────────────────────────────────────────────── SCENE 4
=== childhood_house ===
{
- captured_at_crossing: The verandah steps are wet with small footprints. They go in ahead of you. # scene: house_exterior
- returned_home: The door is open. A light is on inside. # scene: house_exterior
- else: You don't look at the mirror in the hall. You don't want to know if it will smile again. # scene: house_exterior
}
// Corridor — longer than it should be. The family photograph: you (14), Meera (8), your mother. Meera's face is scratched out.
CHILD: Bhaiya? # scene: corridor
AARAV: Meera?
// The door at the end opens by itself. Fully. A dark bedroom.
You remember this room.
You remember leaving her here.
* [Enter the bedroom # dir: ahead] -> enter_bedroom
* [Look closer at the photograph # dir: left] -> examine_photo
* [Call out to Meera # dir: right] -> call_meera

= enter_bedroom
~ entered_bedroom = true
// A wooden horse on the floor rotates — slightly. You kneel.
CHILD: You promised. # scene: bedroom_horse
-> entity_reveal

= examine_photo
~ examined_photo = true
// Three people. Four shadows. The fourth is a woman standing behind the family.
AARAV: Who is that? # scene: photo_shadow
-> entity_reveal

= call_meera
~ called_meera = true
AARAV: Meera! # scene: corridor_call
CHILD: Bhaiya?
AARAV: I'm here.
CHILD: No.
CHILD: You're not.
// The bedroom door closes. Behind you, an adult woman whispers:
WOMAN: He's not your brother anymore.
-> entity_reveal

// ─────────────────────────────────────────────────────────── SCENE 5
=== entity_reveal ===
// End of the corridor. A woman by the far doorway. Faded sari, wet hair, face in darkness. Completely still.
AARAV: Who are you? # scene: entity_reveal
AARAV: Where is Meera?
WOMAN: You remember the road.
WOMAN: But you don't remember what you did.
{entered_bedroom: WOMAN: You touched her horse. She has been holding it for seventeen years.}
{examined_photo: WOMAN: You saw me in the photograph. I was always in it.}
{called_meera: WOMAN: You called her. You should not call the ones you left.}
{captured_at_crossing: WOMAN: You looked at me. Nobody looks at me twice.}
AARAV: What did I do?
WOMAN: You left her.
AARAV: Who?
WOMAN: Me.
// Flicker — for one frame she is closer. Your eyes drop to her feet: bare, turned the wrong way. Hold 3s.
AARAV: Chudail…
WOMAN: That is what they called me.
WOMAN: Before they forgot my name.
-> truth

// ─────────────────────────────────────────────────────────── SCENE 6
=== truth ===
// Bedroom, one candle. Your mother's diary.
You thought you remembered that night. # scene: truth
The rain. The voice. Opening the door.
But you never remembered what happened after.
DIARY: 17 August 1992.
DIARY: The girl from the crossing came again. She asked for shelter. I told her to leave.
DIARY: Aarav heard her crying. Meera opened the door.
DIARY: I should have stopped them.
The truth is in front of you.
Now you have to decide what to do with it.
* [Burn the diary # dir: left] -> ending_forgetting
* [Read the final page # dir: ahead] -> ending_remembering
* [Leave the house and go to the crossing # dir: right] -> ending_return

// ─────────────────────────────────────────────────────────── SCENE 7 — ENDINGS
=== ending_forgetting ===
~ ending = "forgetting"
Some memories are better left buried. # scene: ending_forgetting
// Black. Three knocks — from the player's side of the screen.
{replayed_cassette: MEERA: Bhaiya… you left me outside.}
-> END

=== ending_remembering ===
~ ending = "remembering"
~ remembered_truth = true
DIARY: Meera opened the door. The girl from the crossing was standing outside. # scene: ending_remembering
DIARY: She asked for help. Meera went with her.
DIARY: Aarav watched. He did not stop her.
DIARY: I told everyone that Meera had run away. But she never left the village.
WOMAN: You remember now.
AARAV: I'm sorry.
WOMAN: I know.
WOMAN: But she is still waiting.
{
- entered_bedroom: Beneath the crossing, a little girl is holding a wooden horse.
- else: Beneath the crossing, a little girl is looking at her empty hands, as if something should be there.
}
CHILD: Bhaiya?
-> END

=== ending_return ===
~ ending = "return"
# scene: ending_return
{captured_at_crossing: She is standing exactly where she stood behind you the night you arrived. This time, you don't turn around.}
WOMAN: You came back.
AARAV: Where is Meera?
WOMAN: Where you left her.
// The train passes. When it is gone, you are gone. She stands on the near side now. Her feet face forward. She smiles.
WOMAN: Now you can remember.
-> END
