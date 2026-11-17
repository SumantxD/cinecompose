import { createContext } from 'react'

/** Director renders share story state but never emit sound or overwrite the film world's light registry. */
export const StageModeContext = createContext({ director: false })
