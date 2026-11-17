import { Story } from 'inkjs'

// Erasable TS only (no enums/param properties): scripts/check-episode.mjs imports this file directly in Node.

export interface Line {
  /** NARRATOR for unprefixed lines. */
  speaker: string
  text: string
  /** Seconds after scene start. */
  at?: number
  hold?: number
  /** Local, provenance-recorded voice id from `# vo:`; speaker/text remain authoritative. */
  vo?: string
  /** `# captured` — an entity has the player; the story continues on Ink's branch. */
  captured?: boolean
  /** A `_` line: a beat with no caption (a purely visual shot). */
  silent?: boolean
}

export interface Choice {
  index: number
  text: string
  /** `# dir: ahead|behind|left|right` — where the option sits on screen, as a direction in the world. */
  dir?: string
}

export interface Beat {
  sceneId: string
  lines: Line[]
  choices: Choice[]
  ended: boolean
  /** Set when the path ends in death: the `# dead` line's text, shown as the epitaph. */
  epitaph?: string
}

export const SPEAKERS = ['NARRATOR', 'AARAV', 'DRIVER', 'MEERA', 'WOMAN', 'CHILD', 'DIARY']

function tagMap(tags: string[]) {
  const tag: Record<string, string> = {}
  for (const t of tags) {
    const i = t.indexOf(':')
    if (i > 0) tag[t.slice(0, i).trim()] = t.slice(i + 1).trim()
    else tag[t.trim()] = ''
  }
  return tag
}

const SPEAKER = /^([A-Z]{2,12}):\s*(.*)$/

function parse(raw: string, tags: string[]) {
  const tag = tagMap(tags)
  raw = raw.trim()
  if (raw === '_') return { line: { speaker: 'NARRATOR', text: '', silent: true }, scene: tag.scene as string | undefined, dead: false }
  const m = raw.match(SPEAKER)
  const line: Line = {
    speaker: m ? m[1] : 'NARRATOR',
    text: (m ? m[2] : raw).trim(),
    at: tag.at !== undefined ? Number(tag.at) : undefined,
    hold: tag.hold !== undefined ? Number(tag.hold) : undefined,
    vo: tag.vo || undefined,
    captured: 'captured' in tag || undefined,
  }
  return { line, scene: tag.scene as string | undefined, dead: 'dead' in tag }
}

/** Reads the Ink story one beat at a time. A beat = all lines of one scene up to a choice or a cut. */
export class StoryEngine {
  private story: Story
  private scene = ''
  private pending: ReturnType<typeof parse> | null = null
  flags: Record<string, unknown> = {}

  constructor(json: string | object) {
    this.story = new Story(json as string)
    this.story.variablesState.ObserveVariableChange((name) => {
      this.flags[name] = this.story.variablesState.$(name)
    })
  }

  start(knot?: string) {
    if (knot) this.story.ChoosePathString(knot)
  }

  next(): Beat {
    const lines: Line[] = []
    let epitaph: string | undefined
    if (this.pending) {
      this.scene = this.pending.scene ?? this.scene
      if (this.pending.dead) {
        epitaph = this.pending.line.text
        if (this.pending.line.text) lines.push(this.pending.line)
      } else if (this.pending.line.text || this.pending.line.silent) lines.push(this.pending.line)
      this.pending = null
    }
    while (this.story.canContinue) {
      const p = parse(this.story.Continue() ?? '', this.story.currentTags ?? [])
      if (p.scene && p.scene !== this.scene) {
        if (lines.length) {
          this.pending = p
          return { sceneId: this.scene, lines, choices: [], ended: false }
        }
        this.scene = p.scene
      }
      if (p.dead) {
        epitaph = p.line.text
        if (p.line.text) lines.push(p.line)
      } else if (p.line.text || p.line.silent) lines.push(p.line)
    }
    const choices = this.story.currentChoices.map((c) => ({ index: c.index, text: c.text, dir: tagMap(c.tags ?? []).dir }))
    return { sceneId: this.scene, lines, choices, ended: choices.length === 0, epitaph }
  }

  /** Snapshot of the full story state (position + variables), for checkpoints. */
  save() {
    // The look-ahead line (first line of the next scene) has already left Ink's state, so it travels with the snapshot.
    return { state: this.story.state.ToJson(), scene: this.scene, pending: this.pending }
  }

  load(snap: ReturnType<StoryEngine['save']>) {
    this.story.state.LoadJson(snap.state)
    this.scene = snap.scene
    this.pending = snap.pending
  }

  choose(index: number) {
    this.story.ChooseChoiceIndex(index)
  }
}
