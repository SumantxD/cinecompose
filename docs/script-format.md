# Script Format (Ink)

Writers work in `src/story/episode-NNN.ink`. The build compiles it, so an Ink error fails `npm run dev` with the line number. `npm run check` then plays **every branch** and reports paths, endings, and which scenes are still animatics.

## Lines

```ink
Unprefixed text is the narrator, speaking to the player in second person ("You…").
MEERA: Bhaiya?                       // NAME: text is dialogue
// a comment is a stage direction for directors. It never appears on screen.
```

Speakers allowed: `NARRATOR AARAV DRIVER MEERA WOMAN CHILD DIARY`. To add one, add it to `SPEAKERS` in `StoryEngine.ts`; the check script rejects unknown speakers.

## Tags

| Tag | Meaning |
|---|---|
| `# scene: tea_stall` | Cut to this scene. Matches a `sceneId` in `src/scenes/*/*.json`. A missing one plays as a black animatic. Put it on the first line of the scene. |
| `# at: 4.5` | Show the line 4.5 s after the scene starts. This syncs with camera cues on the same clock. |
| `# hold: 3` | How long it stays on screen. Defaults to reading speed. |
| `_` (a line that is just an underscore) | A **silent beat**: gives a purely visual shot its own scene, no caption. `_ # scene: p1_look` |
| `# vo: clip_id` | Use a local, provenance-recorded performance: a human or an explicitly approved voice-model generation. Never a runtime speech service. |
| `# captured` | An entity has the player. The story continues (Ink decides where). |
| `# dead` | This line is the **epitaph**: it isn't shown as a caption, but on the YOU DIED screen. Follow it with `-> END`. The player offers "Return to the last decision" (automatic checkpoint) and "Start again". |
| choice `# dir: ahead/behind/left/right` | `* [Cross the tracks # dir: ahead]` places the option where it points in the world. |

Lines without `at` are paced automatically, one after another. Unspecified `# hold` includes the baked clip's duration plus a short breath. Explicit holds must contain the clip. Voice playback follows scene time and respects pause, seek and cuts. Captions remain whole-line; no word-level lip-sync is implied.

## Choices

```ink
* [Follow the railway crossing] -> follow_crossing
```

Choice text is short, in the imperative, and has no "safe" option (INT-03). The narration line just before the choices stays on screen while they're shown.

## Flags and echoes

Declare every flag with `VAR` at the top. Set it inside the branch (`~ followed_crossing = true`). Echo it later with a single conditional line (INT-02):

```ink
{entered_bedroom: WOMAN: You touched her horse.}
```

Don't put `//` comments or `#` tags inside `{ … }` inline conditionals. Use a multi-line `{ - cond: … }` block for those.
