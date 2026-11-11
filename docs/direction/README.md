# Product Direction

The *why* behind what we build. This folder captures the creative and product briefs, condensed but with every requirement kept, so any session can check work against them.

| Doc | Brief | Status |
|---|---|---|
| `reels-first.md` | Phase 10: Instagram Reels-first experience | Requirements + quality gate are active. Export not built. |
| `first-person.md` | Phase 11: the player IS the protagonist; narrator; camera modes; diegetic choices | Active. Part 1 is the first slice built to it. |
| `gameplay-horror.md` | Phase 12: hands, flashlight, weapons, jumpscares, chase, capture, death | Partially active: capture/death/YOU DIED states are built (narrative-driven). Hands, weapons, chase and free movement are planned. |

## The three experiences, one world

| Experience | What the player sees | Built on |
|---|---|---|
| Interactive story | Narrator, decisions, first-person world | Ink → player → scene timelines |
| Gameplay horror | Exploration, flashlight, weapons, chase, death | 📋 PLAYER POV camera mode, plus the same sets, entity and audio |
| Cinematic horror | Scripted reveals, jumpscares, capture sequences | Scene JSON cues + technique macros |

All three share **one** set of environments, **one** Entity system, **one** audio manager and **one** story state. Never build a parallel world for "gameplay".

## The central separation

```
INK (what happens) ──► Cinematic Director (how you experience it) ──► camera / environment / audio
        ▲                                                                         │
        └──────────────────────────── player choice ◄─────────────────────────────┘
```

Ink decides the story, consequences, death and capture. Scene JSON and techniques decide the experience. Neither reaches into the other.

## Where these briefs conflict with earlier canon (resolved in `docs/decisions.md`)

1. **"The player does not walk, run or fight"** (master brief) vs **chase and weapons** (Phase 12). → Chapters stay narrator-led POV cinematics with choices. Gameplay sequences (free look, flashlight, chase) arrive as *bounded* segments inside chapters, never an open world. Decision #20.
2. **Aarav as a narrated third person** vs **"the player is the protagonist"**. → You *are* Aarav. The narrator is a separate storyteller who speaks to you in second person. Decision #21.
3. **The woman "never attacks or lunges"** (entity bible) vs **capture sequences**. → She keeps her rules: her capture is *proximity*. She is simply there, an inch away, when you turn. Any entity that chases, crawls or grabs is a *different* entity, still to be designed. Decision #22.
