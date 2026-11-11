# Sound Language

Sound is a main storytelling tool. Silence is a sound, and we use it.

## The motif — SND-01

Three soft bell tones: **E5 → C5 → B♭4**, about 0.62 s apart, with the last note sagging about 3% flat over 1.6 s. Long reverb, low-passed, always distant. At first it sounds like a railway signal bell. It plays **only when she is present**, never louder than 0.3, and is never explained.

## Sound ids (`src/audio/manifest.ts`)

| id | What | Source now | Wanted |
|---|---|---|---|
| `rain` | monsoon rain bed (stereo, loop) | synth | CC0 field recording, heavy rain on leaves and asphalt |
| `night_drone` | sub rumble plus breathing wind (loop) | synth | CC0 night ambience |
| `hum` | 50 Hz ballast hum (loop, spatial, follows its light) | synth | keep the synth, it's good |
| `tube_tick` | starter click plus buzz stutter | synth | recording of a real choke starter |
| `signal` | the motif | synth | keep the synth; maybe a recorded bell resynthesised |

| `footstep` | wet step on asphalt (used via the SND-03 macro, synced to the walk bob) | synth | CC0 recording, several variations |
| `anklets` | payal, a cluster of tiny ankle bells: **her** footsteps | synth | recording of real payal, which matters for cultural authenticity |
| `train_horn` | dissonant diesel horn, approaching | synth | CC0 Indian loco horn |
| `capture_hit` | the one loud moment (sub drop + burst + dissonant cluster) | synth | keep it designed, not recorded |

Still needed: `train_pass`, `footstep_wood`, `door_creak`, `door_slam_far`, `knock_three`, `radio_static`, `cassette_click`, `cassette_hiss`, `fan_ceiling`, `candle`, `paper_burn`, `frogs_insects`.

## Mixing rules

- Ambient beds: rain ≈ 0.55 outside and ≈ 0.25 inside (muffled), drone ≈ 0.2–0.3.
- No sound above 0.8. There's no loud stinger in Episode 1 except the train horn (Choice A), which cuts to silence (EDT-01).
- Spatial sounds (`spatial: true`) take the cue's `position`. The listener follows the camera.
- Dialogue (once recorded) sits clearly above the beds. Ambience ducks by about 30% under VO.
- Mobile speakers drop everything below ~150 Hz. Nothing story-critical can live only in the low end.

## Voice (planned)

Hire or volunteer voice actors per character. Files: `public/audio/vo/<knot>_<n>.ogg`. The Ink line gets a tag `# vo: <file>`. Radio and cassette lines get a band-pass (SND-02). Meera's tape voice is recorded through a real cassette deck if possible.
