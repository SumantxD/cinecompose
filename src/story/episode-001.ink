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
रात के ठीक दो बजकर सत्रह मिनट हो रहे हैं। # scene: p1_car # at: 3 # hold: 4.1 # vo: part1_opening_hi
You have not been back to Sonpahari in seventeen years. # at: 7.5 # hold: 3.6
In your hand, a cassette nobody should have been able to send you. On the label: MEERA — 17/08/1992. # at: 11.5 # hold: 4.6
Meera was eight when she disappeared. # at: 16.5 # hold: 3
DRIVER: Yahin utarna hai? # at: 20.3 # hold: 2.6
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
-> tea_stall

// ═══════════════════════════════════════════════════════════ PART 2 — THE HOUSE
// Consequences and inventory come from Ink. Cameras, light changes and sound timing come from scene JSON.

=== tea_stall ===
{
- captured_at_crossing:
The bench is hard beneath your back. Your cassette is on the counter. You don't remember putting it there. # scene: tea_wake # at: 0.688 # hold: 4.042
- else:
The old tea stall still has a light on. A radio and a cassette player sit under it, side by side. # scene: tea_stall # at: 0.688 # hold: 3.87
}
MEERA: Bhaiya? # at: 6.45 # hold: 2.15
AARAV: Meera? # at: 9.46 # hold: 1.892
The reply comes from the radio. Its power cord lies curled on the counter. # at: 12.04 # hold: 3.526
For a moment, the mirror shows a woman behind you. You don't turn around. # at: 16.34 # hold: 3.87
The room beyond the counter is empty. # at: 21.5 # hold: 3.096
MEERA: Bhaiya… ghar mat aana. # at: 25.8 # hold: 3.01
-> first_decision

=== first_decision ===
She asked you not to go. For seventeen years, you have used that warning as an excuse. # scene: tea_stall_tape # at: 0.43 # hold: 3.87
AARAV: Tujhe kya hua tha? # at: 6.88 # hold: 2.58
MEERA: Aap phir se dekh lo. # at: 11.18 # hold: 2.752
Three knocks come from inside the wall. # at: 15.48 # hold: 2.924
The house is waiting. So is her voice. # at: 19.78 # hold: 3.01
* [Take the cassette and go to the house # dir: ahead] -> go_home
* [Play the last part again # dir: left] -> replay_cassette
* [Stay with her voice until morning # dir: behind] -> ending_waiting

= go_home
You pick up the cassette. It is lighter than you remember. # scene: road_footsteps # at: 0.602 # hold: 2.924
Your footsteps follow you into the village. The other set stops when you do. # at: 4.73 # hold: 3.526
Someone has left a light on in your mother's house. # at: 9.46 # hold: 3.01
-> childhood_house

= replay_cassette
~ replayed_cassette = true
You press rewind. The reels turn without a motor. # scene: tea_stall_mirror # at: 0.43 # hold: 3.44
MEERA: Bhaiya… ghar mat aana. # at: 6.02 # hold: 3.096
Under her voice is an older recording. A woman trying not to wake the house. # at: 10.32 # hold: 3.698
DIARY: Meera, darwaza band karo. # at: 15.48 # hold: 2.924
CHILD: Bhaiya is awake. # at: 19.78 # hold: 2.494
The words hiss into a different quiet. # at: 24.08 # hold: 2.752
WOMAN: I only asked for shelter. # at: 28.38 # hold: 3.268
The mirror no longer shows a woman. It shows the way to your house. # at: 33.54 # hold: 3.87
-> childhood_house

=== childhood_house ===
{
- captured_at_crossing:
There are small footprints under the verandah roof. Dry, in all this rain. They go in ahead of you. # scene: house_exterior_captured # at: 0.516 # hold: 3.87
- replayed_cassette:
You know your mother's voice now. What you don't know is who recorded her that night. # scene: house_exterior # at: 0.516 # hold: 3.698
- else:
The verandah is exactly as you left it. The door is open. A light is on inside. # scene: house_exterior # at: 0.516 # hold: 3.698
}
CHILD: Bhaiya? # scene: corridor # at: 0.86 # hold: 2.064
The corridor is longer than you remember. The room at the end has not moved. # at: 4.3 # hold: 3.612
CHILD: Bhaiya, darwaza kholo. # at: 9.46 # hold: 3.182
You remember this room. You remember leaving her here. # at: 13.76 # hold: 3.612
Her horse is inside the room. Her face has been scratched out of the family photograph. Her voice is behind the door. # at: 18.92 # hold: 4.73
* [Take the horse to her # dir: ahead] -> enter_bedroom
* [Look at the photograph # dir: left] -> examine_photo
* [Call Meera to the door # dir: right] -> call_meera

= enter_bedroom
~ entered_bedroom = true
The wooden horse is beside the bed. Its rockers are worn. # scene: bedroom_horse # at: 0.516 # hold: 3.182
CHILD: You promised you would come back. # at: 5.16 # hold: 3.612
AARAV: I know. # at: 10.32 # hold: 2.236
You pick it up. It is still small enough for her hands. # at: 13.76 # hold: 3.612
-> entity_reveal

= examine_photo
~ examined_photo = true
Three people stand in the photograph. Four shadows fall across the wall behind them. # scene: photo_shadow # at: 0.43 # hold: 4.042
The fourth shadow belongs to a woman. # at: 6.02 # hold: 2.924
AARAV: You were there? # at: 10.32 # hold: 2.58
There is no answer from the house. # at: 14.62 # hold: 3.182
-> entity_reveal

= call_meera
~ called_meera = true
AARAV: Meera! Andar aa jao. # scene: corridor_call # at: 0.602 # hold: 2.924
CHILD: Bhaiya? # at: 4.3 # hold: 2.064
AARAV: I'm here. # at: 7.74 # hold: 2.064
CHILD: No. # at: 11.18 # hold: 1.548
CHILD: You're not. # at: 13.76 # hold: 2.322
{
- heard_rule:
You told yourself the driver's rule belonged to the crossing. You lift your voice again anyway. # at: 18.06 # hold: 4.3
WOMAN: He's not your brother anymore. # at: 23.22 # hold: 3.87
- else:
WOMAN: He's not your brother anymore. # at: 18.92 # hold: 3.87
}
-> entity_reveal

=== entity_reveal ===
She is at the far end of the corridor. Not standing in the doorway. Standing beyond it. # scene: entity_reveal # at: 0.43 # hold: 3.526
AARAV: What did you do with Meera? # at: 5.16 # hold: 2.924
WOMAN: You remember the road. You don't remember what you did. # at: 9.46 # hold: 4.042
{
- entered_bedroom: WOMAN: You picked up her horse. She has been holding it for seventeen years. # at: 14.62 # hold: 4.042
}
{
- examined_photo: WOMAN: You saw me in the photograph. I was always in it. # at: 14.62 # hold: 4.042
}
{
- called_meera: WOMAN: You called her again. You never think about who taught her to call you. # at: 14.62 # hold: 4.386
}
{
- replayed_cassette: WOMAN: You listened to the end. Most people stop when a child says no. # at: 19.78 # hold: 4.73
}
AARAV: What did I do? # at: 21.5 # hold: 2.58
WOMAN: You left her. # at: 25.8 # hold: 2.408
AARAV: Who? # at: 29.24 # hold: 2.064
WOMAN: Me. # at: 32.68 # hold: 2.236
Her feet are bare. The heels point toward you. # at: 36.98 # hold: 3.784
AARAV: Chudail… # at: 42.14 # hold: 2.15
WOMAN: That is what they called me. # at: 45.58 # hold: 3.01
WOMAN: Before they forgot my name. # at: 50.74 # hold: 3.526
-> truth

=== truth ===
On the table is your mother's diary, open to the date you have never forgotten. # scene: truth # at: 0.43 # hold: 3.526
DIARY: 17 August 1992. # at: 5.16 # hold: 2.494
DIARY: The girl from the crossing came again. She asked for shelter. I told her to leave. # at: 8.6 # hold: 4.128
DIARY: Meera heard her crying. You watched from the window. # at: 13.76 # hold: 3.182
DIARY: I thought someone else would open a door. # at: 18.06 # hold: 3.096
DIARY: Meera opened ours. # at: 22.36 # hold: 2.752
You came here for a voice. The house has something harder to hear. # at: 26.66 # hold: 3.698
* [Burn the diary. Let the family keep its secret # dir: left] -> ending_forgetting
* [Read the final page. Whatever it says about you # dir: ahead] -> ending_remembering
* [Take what you know back to the crossing # dir: right] -> ending_return

=== ending_forgetting ===
~ ending = "forgetting"
The corner of the page curls first. Then the date. Then the hand that wrote it. # scene: ending_forgetting # at: 0.43 # hold: 3.956
You protect the family that asked her to leave. # at: 6.02 # hold: 3.096
There is no one left to tell you what you saw. # at: 10.32 # hold: 3.44
The rain stops. # at: 15.48 # hold: 2.752
Three knocks come from behind you. # at: 19.78 # hold: 3.01
{replayed_cassette: MEERA: Bhaiya… you left me outside. # at: 24.94 # hold: 3.87}
-> END

=== ending_waiting ===
~ ending = "waiting"
You stay. You don't go to the house. # scene: ending_waiting # at: 0.43 # hold: 3.01
MEERA: Bhaiya… # at: 5.16 # hold: 2.15
The kettle is warm. Her voice asks for nothing. It is easy to stay. # at: 9.46 # hold: 3.956
You let the house keep what it knows. # at: 15.48 # hold: 3.44
When the first light reaches the road, the radio falls silent. # at: 20.64 # hold: 3.87
There is no tape left to rewind. # at: 26.66 # hold: 3.182
The house is still there. So is the page you never read. # at: 31.82 # hold: 4.128
-> END

=== ending_remembering ===
~ ending = "remembering"
~ remembered_truth = true
The last page holds your mother's confession. The last four words are yours. # scene: ending_remembering # at: 0.43 # hold: 3.698
AARAV: Main dekh raha tha. Main kuch nahi kiya. # at: 5.16 # hold: 3.354
DIARY: You told me, "I thought you would stop her." # at: 9.46 # hold: 3.268
DIARY: I let you think the silence was yours alone. # at: 13.76 # hold: 3.096
DIARY: The girl waited outside. Meera went with her. She left her horse by your bed. # at: 17.2 # hold: 4.042
DIARY: Meera looked back at you. You saw her hand. You did not move. # at: 22.36 # hold: 3.784
DIARY: I told everyone she ran away. She never left the village. # at: 27.52 # hold: 3.612
AARAV: I watched her go. # at: 32.68 # hold: 2.838
WOMAN: You remember now. # at: 36.98 # hold: 2.924
AARAV: I'm sorry. # at: 41.28 # hold: 2.408
WOMAN: I know. # at: 45.58 # hold: 2.408
WOMAN: But she is still waiting. # at: 49.88 # hold: 3.784
{
- entered_bedroom:
Beneath the far barrier, Meera holds the horse in both hands. # scene: ending_remembering_horse # at: 0.43 # hold: 3.44
- else:
Beneath the far barrier, Meera holds her empty hands as if something should be there. # scene: ending_remembering_empty # at: 0.43 # hold: 3.784
}
CHILD: Bhaiya? # at: 4.73 # hold: 3.096
-> END

=== ending_return ===
~ ending = "return"
The rain follows you back to the rails. # scene: ending_return # at: 0.43 # hold: 2.924
{
- captured_at_crossing:
This time, you don't look behind you. # at: 4.3 # hold: 2.838
}
You put the cassette on the wet ground between the tracks. # scene: ending_return # at: 8.6 # hold: 3.44
{
- entered_bedroom:
You put the horse beside it. # scene: ending_return_horse # at: 12.9 # hold: 3.01
}
AARAV: I remember. Is that enough? # at: 16.34 # hold: 3.268
WOMAN: You came back. # at: 20.64 # hold: 2.752
AARAV: Where is Meera? # at: 24.94 # hold: 2.494
WOMAN: Where you left her. # at: 29.24 # hold: 2.752
The rails begin to hum. # at: 33.54 # hold: 2.752
The train passes. When it is gone, you are gone. # at: 39.56 # hold: 3.698
She stands on the near side now. Her feet face forward. She smiles. # at: 46.44 # hold: 4.73
WOMAN: Now you can remember. # at: 53.32 # hold: 3.44
-> END
