import { create } from 'zustand'
import { Clip, SEED, SCRIPTS } from './mock'

type State = {
  activeProjectId: string | null
  clips: Clip[]; sel: number; scripts: Record<number, string>
  analyze: number; voice: number[]; render: number
  captionStyle: string; captionSize: number
  keys: { gemini: string; eleven: string }
  set: (p: Partial<State>) => void
  move: (i: number, d: number) => void
}
export const useStore = create<State>((set, get) => ({
  activeProjectId: null, clips: SEED, sel: 0, scripts: SCRIPTS, analyze: 0, voice: SEED.map(() => 100), render: 0,
  captionStyle: 'TikTok', captionSize: 24, keys: { gemini: '', eleven: '' },
  set: (p) => set(p),
  move: (i, d) => {
    const c = [...get().clips], j = i + d
    if (j < 0 || j >= c.length) return
    ;[c[i], c[j]] = [c[j], c[i]]
    set({ clips: c, sel: j })
  },
}))
export const total = (c: Clip[]) => c.reduce((a, x) => a + x.duration, 0)
export const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
