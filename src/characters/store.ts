import { create } from 'zustand'
import { DEFAULT_MOTION, putPositionKey, putRotationKey, validClip } from './types.ts'
import type { CharacterClip, CharacterMotion, IKTarget, QuaternionValue, Vec3 } from './types.ts'

export interface CharacterDocument { version: 1; activeId: string; clips: CharacterClip[] }
const KEY = 'kr-character-lab-v1'
let storageOK = true
let recovery: string | null = null
const blank = (): CharacterClip => ({ id: 'clip1', name: 'Character study', duration: 4, motion: { ...DEFAULT_MOTION }, tracks: {}, targets: {} })
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function decode (raw: string): CharacterDocument {
  const doc = JSON.parse(raw) as CharacterDocument
  const ids = new Set(doc.clips?.map((clip) => clip.id))
  if (doc.version !== 1 || !doc.clips?.length || ids.size !== doc.clips.length || [...ids].some((id) => !id) || !doc.clips.every(validClip)) throw new Error('Invalid character document')
  doc.clips.forEach((clip) => { clip.motion = { ...DEFAULT_MOTION, ...clip.motion, reach: { ...clip.motion.reach } } })
  return { version: 1, clips: doc.clips, activeId: doc.clips.some((clip) => clip.id === doc.activeId) ? doc.activeId : doc.clips[0].id }
}

function restore(): CharacterDocument {
  const initial = (): CharacterDocument => ({ version: 1, activeId: 'clip1', clips: [blank()] })
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initial()
    return decode (raw)
  } catch {
    try {
      const raw = localStorage.getItem(KEY)
      recovery = raw
      if (raw && !localStorage.getItem(`${KEY}-recovery`)) localStorage.setItem(`${KEY}-recovery`, raw)
    } catch { storageOK = false }
    return initial()
  }
}

interface CharacterStore {
  storageOK: boolean
  recovery: string | null
  doc: CharacterDocument
  past: string[]
  future: string[]
  time: number
  playing: boolean
  begin: () => void
  change: (fn: (clip: CharacterClip) => void) => void
  setMotion: (motion: Partial<CharacterMotion>) => void
  setTime: (time: number) => void
  selectClip: (id: string) => void
  newClip: () => void
  deleteClip: () => void
  undo: () => void
  redo: () => void
  load: (raw: string) => boolean
}

const current = (doc: CharacterDocument) => doc.clips.find((clip) => clip.id === doc.activeId) ?? doc.clips[0]
const finiteTime = (value: unknown, duration: number) => Number.isFinite(value) ? Math.max(0, Math.min(duration, value as number)) : 0

export const useCharacter = create<CharacterStore>((set, get) => ({
  doc: restore(), storageOK, recovery, past: [], future: [], time: 0, playing: false,
  begin: () => set({ past: [...get().past.slice(-59), JSON.stringify(get().doc)], future: [] }),
  change: (fn) => {
    const doc = clone(get().doc)
    const clip = current(doc)
    fn(clip)
    if (!validClip(clip)) return
    set({ doc, time: Math.min(get().time, clip.duration) })
  },
  setMotion: (patch) => {
    get().begin()
    get().change((clip) => {
      const motion = { ...clip.motion, ...patch }
      if (Number.isFinite(motion.speed)) motion.speed = Math.max(0, motion.speed)
      clip.motion = motion
    })
  },
  setTime: (time) => set({ time: finiteTime(time, current(get().doc).duration), playing: false }),
  selectClip: (id) => set((state) => ({ doc: { ...state.doc, activeId: id }, time: 0, playing: false })),
  load: (raw) => {
    try {
      const doc = decode (raw)
      set((state) => ({ doc, past: [...state.past.slice(-59), JSON.stringify(state.doc)], future: [], time: 0, playing: false, recovery: null }))
      return true
    } catch { return false }
  },
  newClip: () => {
    const ids = new Set(get().doc.clips.map((clip) => clip.id))
    let number = 1
    while (ids.has(`clip${number}`)) number++
    const clip = { ...blank(), id: `clip${number}`, name: `Clip ${number}` }
    get().begin()
    set((state) => ({ doc: { version: 1, clips: [...state.doc.clips, clip], activeId: clip.id }, time: 0, playing: false }))
  },
  deleteClip: () => {
    if (get().doc.clips.length <= 1) return
    get().begin()
    set((state) => {
      const clips = state.doc.clips.filter((clip) => clip.id !== state.doc.activeId)
      return { doc: { version: 1, clips, activeId: clips[0].id }, time: 0, playing: false }
    })
  },
  undo: () => {
    const { past, future, doc } = get()
    if (!past.length) return
    const restored = JSON.parse(past.at(-1)!) as CharacterDocument
    set({ doc: restored, past: past.slice(0, -1), future: [JSON.stringify(doc), ...future], time: Math.min(get().time, current(restored).duration) })
  },
  redo: () => {
    const { past, future, doc } = get()
    if (!future.length) return
    const restored = JSON.parse(future[0]) as CharacterDocument
    set({ doc: restored, future: future.slice(1), past: [...past, JSON.stringify(doc)], time: Math.min(get().time, current(restored).duration) })
  },
}))

useCharacter.subscribe((state, previous) => {
  if (state.doc === previous.doc) return
  try {
    localStorage.setItem(KEY, JSON.stringify(state.doc))
    storageOK = true
  } catch {
    storageOK = false
  }
  if (state.storageOK !== storageOK) useCharacter.setState({ storageOK })
})

export const activeClip = () => current(useCharacter.getState().doc)

export function flipPlayback(): void {
  const { time, playing, doc } = useCharacter.getState()
  useCharacter.setState({ playing: !playing, time: !playing && time >= current(doc).duration - 0.001 ? 0 : time })
}

export function removeKeys(part: string): void {
  useCharacter.getState().change((clip) => {
    if (part.startsWith('ik:')) delete clip.targets[part.slice(3) as IKTarget]
    else delete clip.tracks[part]
  })
}

export function keyRotation(time: number, bone: string, q: QuaternionValue): void {
  useCharacter.getState().change((clip) => {
    const track = clip.tracks[bone] ?? (clip.tracks[bone] = {})
    putRotationKey(track, time, q)
  })
}
export function keyPosition(time: number, bone: string, v: Vec3): void {
  useCharacter.getState().change((clip) => {
    const track = clip.tracks[bone] ?? (clip.tracks[bone] = {})
    track.position = putPositionKey(track.position, time, v)
  })
}
export function keyIK(time: number, target: IKTarget, v: Vec3): void {
  useCharacter.getState().change((clip) => {
    clip.targets[target] = putPositionKey(clip.targets[target], time, v)
    clip.motion.reach = { ...clip.motion.reach, [target]: v }
  })
}
