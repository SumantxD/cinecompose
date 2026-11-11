import episode from '../story/episode-001.ink'
import { StoryEngine, type Line } from '../story/StoryEngine'

// The Studio previews a scene with its real captions: walk the story (all branches) to the first beat
// that plays this scene and take its lines. Cached per scene.
const cache = new Map<string, Line[]>()

export function linesForScene(sceneId: string): Line[] {
  if (cache.has(sceneId)) return cache.get(sceneId)!
  let found: Line[] = []
  const walk = (picks: number[]): boolean => {
    const e = new StoryEngine(episode)
    let i = 0
    for (let guard = 0; guard < 200; guard++) {
      const beat = e.next()
      if (beat.sceneId === sceneId) return (found = beat.lines), true
      if (beat.choices.length) {
        if (i === picks.length) return beat.choices.some((_, c) => walk([...picks, c]))
        e.choose(picks[i++])
      } else if (beat.ended) return false
    }
    return false
  }
  walk([])
  cache.set(sceneId, found)
  return found
}
