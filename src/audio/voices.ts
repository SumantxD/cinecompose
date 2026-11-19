export interface VoiceClip {
  id: string
  src: string
  duration: number
  volume?: number
}

// Local, provenance-recorded audio only. Generation happens outside the game.
export const VOICES: Record<string, VoiceClip> = {
  part1_opening_hi: { id: 'part1_opening_hi', src: '/audio/vo/part1_opening_hi.wav', duration: 3.8613333333333335, volume: 0.75 },
}
