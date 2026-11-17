import { planEnvironment, hashText } from './EnvironmentPlanner.ts'
import { validateWorld, type SceneSpecification, type Vec2, type WorldLandmark } from './types.ts'

/** Grammar examples map authoring terms to registered assemblies. New entries are added without touching the compiler. */
const TERMS = [
  { pattern: /temple|mandir|shrine|church|mosque|sanctuary/i, assembly: 'classic/stone-temple', tags: ['destination', 'religious'] },
  { pattern: /well|stepwell|water tank|pond|lake|stream|river/i, assembly: 'classic/stone-well', tags: ['water'] },
  { pattern: /hut|house|home|cottage|cabin|room/i, assembly: 'classic/mud-house', tags: ['shelter'] },
  { pattern: /ruin|broken wall|crumbling|collapsed/i, assembly: 'classic/broken-wall', tags: ['ruin'] },
  { pattern: /cart|wagon|carriage/i, assembly: 'classic/broken-wall', tags: ['prop'] },
  { pattern: /watchtower|tower|cliff lookout/i, assembly: 'classic/wood-watchtower', tags: ['elevated'] },
]

const relation = (to: WorldLandmark, direction: string, distance: number): Vec2 => {
  const angle = direction === 'north' ? -Math.PI / 2 : direction === 'south' ? Math.PI / 2 : direction === 'east' ? 0 : direction === 'west' ? Math.PI : direction === 'behind' ? -Math.PI / 2 : Math.PI / 2
  return [to.position[0] + Math.cos(angle) * distance, to.position[1] + Math.sin(angle) * distance]
}

/**
 * Deterministic natural-language authoring baseline. It preserves stated positions and records inferences.
 * A richer agent prompt may additionally produce this JSON, but it must pass validateWorld() as input.
 */
export function storyToScene(description: string, seed = hashText(description)): SceneSpecification {
  const text = description.slice(0, 4000).trim()
  if (!text) throw new Error('Describe a place, or paste a valid SceneSpecification object.')
  if (text.startsWith('{')) {
    const spec = JSON.parse(text) as SceneSpecification
    const errors = validateWorld(spec)
    if (errors.length) throw new Error(errors.join('\n'))
    return spec
  }
  const profile = /valley|plateau|canyon|terraced|step/.test(text) ? 'terraced' : /mountain|ridge|hill|cliff/.test(text) ? 'ridged' : /island|coast|sea|shore/i.test(text) ? 'island' : 'rolling'
  const defaultSpec = planEnvironment(seed, profile, {
    kind: 'story', description: text, reconstructed: false,
    notes: ['Spatially explicit relations from the description are kept. Unmentioned geometry is inferred, not observed.'],
  })
  const matches = TERMS.map((term) => ({ term, found: term.pattern.test(text) })).filter((x) => x.found)
  const landmarks: WorldLandmark[] = matches.map(({ term }, index) => ({
    id: `story_${index}`, assembly: term.assembly, tags: term.tags,
    position: index === 0 ? [0, -38] : [(index % 2 ? -1 : 1) * (10 + index * 2), -38 + index * 9],
    scale: 0.9 + (index % 3) * 0.1,
  }))
  if (!landmarks.length) return { ...defaultSpec, landmarks: [], camera: { position: [0, 35], target: null }, source: { ...defaultSpec.source, notes: [...defaultSpec.source.notes, 'No registered landmark terms were found; only the continuous landscape and its authored route were generated.'] } }
  for (let i = 1; i < landmarks.length; i++) {
    const phrase = text.match(new RegExp(`(north|south|east|west|behind|beside|near|by|left of|right of)`, 'i'))?.[1]?.toLowerCase() ?? 'near'
    landmarks[i].position = relation(landmarks[0], phrase, /near|by/.test(phrase) ? 14 : 11)
  }
  defaultSpec.landmarks = landmarks
  defaultSpec.camera = { position: [0, 35], target: landmarks[0].id }
  defaultSpec.routes[0].points = [[0, 38], [0, 10], [landmarks[0].position[0], landmarks[0].position[1] + 8], landmarks[0].position]
  defaultSpec.source = {
    kind: 'story', description: text, reconstructed: false,
    notes: [
      'Assembly hints were matched from the authoring terms in the description.',
      'Place/scale layout is inferred where the description does not specify a relationship.',
    ],
  }
  const errors = validateWorld(defaultSpec)
  if (errors.length) throw new Error(errors.join('\n'))
  return defaultSpec
}
