import type { EnvironmentEffect } from '../cinematic/types'
import { clock } from '../cinematic/clock'
import { Lightning } from './Lightning'
import { Tornado } from './Tornado'
import { Earthquake } from './Earthquake'
import { Flood } from './Flood'

/** 0 outside the active window, with short fade-in/out ramps so effects never pop on hard. */
export function effectEnvelope(fx: EnvironmentEffect, t = clock.t): number {
  const local = t - fx.at
  if (local < 0 || local > fx.duration) return 0
  return Math.min(1, local / 0.3, (fx.duration - local) / 0.4)
}

/** Reusable environmental toolkit. Mounted once per Stage; scenes opt in via `effects` JSON. */
export function EnvironmentEffects({ effects = [] as EnvironmentEffect[] }) {
  const quakes = effects.filter((fx) => fx.type === 'earthquake')
  return (
    <>
      {effects.map((fx) => {
        switch (fx.type) {
          case 'lightning': return <Lightning key={fx.id} fx={fx} />
          case 'tornado': return <Tornado key={fx.id} fx={fx} />
          case 'flood': return <Flood key={fx.id} fx={fx} />
          default: return null
        }
      })}
      {quakes.length > 0 && <Earthquake effects={quakes} />}
    </>
  )
}
