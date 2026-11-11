# The Woman from the Crossing

Read this before writing, lighting, staging or modelling her. These rules make her memorable. Breaking them makes her generic.

## Who she is

She's a person the village failed. She asked for shelter on 17 August 1992 and was turned away. Her relationship with Meera is the central mystery. She isn't evil. She's tired, patient, and owed something. In Ending B, when she's finally seen clearly, she should look **tired, not monstrous**.

## How she looks (Entity v1, `src/components/Entity.tsx`)

- **Height 1.84 m.** Slightly too tall for a woman of the region, but not obviously so.
- **An old, faded cotton sari** in off-white or cream, with a faded maroon border. It's wet and darkened with mud toward the hem. The pallu is drawn over her head.
- **Wet black hair** hangs forward over her face down to her chest. In Episode 1 her **face is never visible** except in Ending B.
- **Arms hang about 10 cm lower than they should**, with long fingers.
- **Feet are reversed:** heels toward the viewer, toes behind. This must be subtle in wide shots and unmistakable in the one close-up (Scene 5). Never gory or exaggerated.

## The reveal ladder (Episode 1)

She is revealed one step at a time. Don't skip a step, and don't go back down one.

1. A reflection (tea stall mirror, 2 seconds)
2. A distant silhouette (beyond the crossing barrier)
3. A familiar voice ("He's not your brother anymore")
4. A full figure, face hidden (corridor, Scene 5)
5. The reversed feet (Scene 5, 3-second hold)
6. Her history (the diary)
7. Her face, only in Ending B

## Behaviour rules

- **Absolute stillness** (ENT-01). Her only movements: a slow head tilt (ENT-02), a sub-threshold head snap (ENT-03), and changes of position that happen **in darkness** (ENT-04).
- She never runs, crawls, lunges, screams, or attacks. **Her capture is proximity:** when you turn, she is simply there, an arm's length away (Part 1 `p1_look`). Gameplay chases and grabs belong to *other* entities (decision #22).
- **Her shadow can arrive without her** (shadow-only entity, Part 1). When she moves, she glides; her limbs never move.
- **Anklets (payal)** are heard in step with your footsteps when she follows you. Along with the three-note motif, they're her sound.
- She never appears or disappears on camera in a lit frame. The light changes, and then she has changed.
- She speaks quietly, in short sentences, and never explains herself.
- **Her sound** is the three-note motif (SND-01). It plays when she is present, never when she isn't.
- **Light and her:** she stands just outside the pool of a lamp, backlit by sodium light (LGT-01). Later episodes: lights react to her (LGT-07).

## Lines she has (Episode 1)

"He's not your brother anymore." · "You remember the road. But you don't remember what you did." · "You left her." · "Me." · "That is what they called me. Before they forgot my name." · "You remember now." · "I know. But she is still waiting." · "You came back." · "Where you left her." · "Now you can remember."

Don't give her more lines in Episode 1 than she needs.

## Upgrades wanted

- A close-up foot model for CAM-09 (toes, nails, wet skin, mud).
- A face for Ending B: a procedural or CC0 head that reads as an ordinary tired woman.
- Cloth that moves slightly in wind (a vertex shader on the pallu edge only).
- `feet: "forward"` mode for Ending C (ENT-06).
