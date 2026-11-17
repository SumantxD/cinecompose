# Sound Language

Sound is a main storytelling tool. Silence is a sound, and we use it.

## The motif — SND-01

Three soft bell tones: **E5 → C5 → B♭4**, about 0.62 s apart, with the last note sagging about 3% flat over 1.6 s. Long reverb, low-passed, always distant. At first it sounds like a railway signal bell. It plays **only when she is present**, never louder than 0.3, and is never explained.

## Sound ids (`src/audio/manifest.ts`)

| id | What | Source now | Wanted |
|---|---|---|---|
| `rain` | outdoor monsoon beds (stereo, loops) | synth | CC0 field recording, heavy rain on leaves and asphalt |
| `rain_indoor` | low-passed monsoon under a roof (loop) | synth | CC0 interior rain; current synth also uses roof-weighted `drip_tin` taps |
| `night_drone` | sub rumble plus breathing wind (loop) | synth | CC0 night ambience |
| `hum` | 50 Hz ballast hum (loop, spatial, follows its light) | synth | keep the synth, it's good |
| `tube_tick` | starter click plus buzz stutter | synth | recording of a real choke starter |
| `signal` | the motif | synth | keep the synth; maybe a recorded bell resynthesised |

| `footstep` | wet step on asphalt (used via the SND-03 macro, synced to the walk bob) | synth | CC0 recording, several variations |
| `anklets` | payal, a cluster of tiny ankle bells: **her** footsteps | synth | recording of real payal, which matters for cultural authenticity |
| `train_horn` | dissonant diesel horn, approaching | synth | CC0 Indian loco horn |
| `capture_hit` | the one loud moment (sub drop + burst + dissonant cluster) | synth | keep it designed, not recorded |

`rain_indoor` derives from the existing rain synthesis and applies a 1.2 kHz low-pass. Indoor scenes route to it in scene JSON; the outdoor leaf/earth bed fades out while roof-focused tin/puddle taps fade in. Exterior and return-road scenes retain outdoor rain. `rain` stays the outdoor identity. Existing `train_pass`, `footstep_wood`, `knock_three`, `radio_static`, cassette sounds, `fan_ceiling` and `paper_burn` have synth fallbacks. Still desired: `door_creak`, `door_slam_far`, `candle`, `frogs_insects`, plus licensed recordings.

## Mixing rules

- Ambient beds: rain is lower inside, around 0.24–0.26 plus restrained roof taps; outside is around 0.5 where appropriate. Drone ≈ 0.2–0.3.
- No sound above 0.8. There's no loud stinger in Episode 1 except the train horn (Choice A), which cuts to silence (EDT-01).
- Spatial sounds (`spatial: true`) take the cue's `position`. The listener follows the camera.
- Dialogue (once recorded) sits clearly above the beds. Ambience ducks by about 30% under VO.
- Mobile speakers drop everything below ~150 Hz. Nothing story-critical can live only in the low end.

## Voice (provisional Hindi narrator; the rest is unvoiced)

The user's later direction explicitly permits voice-model generation. The current opening is a **provisional AI Hindi narrator**: `public/audio/vo/part1_opening_hi.wav`, generated locally with Kokoro `hm_omega` and Hindi espeak phonemisation. It is not English TTS, a human actor, or a voice clone. The earlier English prototype was withdrawn. Model weights, gated Indic Parler models, unsupported-Hindi Qwen models and non-commercial Piper voices are not bundled.

The exact caption is **रात के ठीक दो बजकर सत्रह मिनट हो रहे हैं।**, with `# vo: part1_opening_hi`. It lasts 3.861333 seconds and its `# hold` is 4.1 seconds. The rest of the opening captions moved 1.1 seconds later so speech and captions do not overlap. Film camera paths and the scene's 24.5-second duration stay unchanged. Full source/license/generation provenance is recorded next to the file. This remains an audition, not an approved professional performance.

Meera remains eight. Do not use an adult synthetic voice, an adult recording or pitch conversion as a child substitute. Keep her unvoiced unless an appropriate, permitted performance or age-appropriate voice is deliberately approved. Do not invent supernatural dialogue to make the voice library seem fuller.

Voice playback follows the scene clock, pauses/scrubs silently, cancels stale loads and ducks ambience by 30%. Generation happens outside the game; the browser plays only locally baked audio and does not call a speech service. The other lines remain captioned until their own recordings and language/performance choices are approved. `scripts/check-voice-playback.mjs` checks actual playback, seeking, pause/resume and stale-request cancellation.

Radio and cassette lines get a band-pass (SND-02); Meera's tape voice is ideally recorded through a real cassette deck. The narrator remains non-positional; existing spatial effects retain their authored positions.