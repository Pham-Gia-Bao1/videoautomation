export const STEPS = [
  { key: 'upload', title: 'Upload', cta: 'Continue to Arrange' },
  { key: 'arrange', title: 'Arrange', cta: 'Analyze Videos with AI' },
  { key: 'analyze', title: 'Analyze', cta: 'Review Generated Script' },
  { key: 'script', title: 'Script', cta: 'Submit Script & Generate Voice' },
  { key: 'voice', title: 'Voice', cta: 'Continue to Captions' },
  { key: 'captions', title: 'Captions', cta: 'Render Video' },
  { key: 'export', title: 'Export', cta: '' },
] as const
export const stepIndex = (path: string) => {
  const k = path.split('/')[1]
  return k === 'render' ? 6 : STEPS.findIndex((s) => s.key === k)
}
export type Clip = { id: number; name: string; duration: number; hue: number; sizeMb: number; sceneId?: string }
export const SEED: Clip[] = [
  { id: 0, name: '01_yakitori_grill.mp4', duration: 12, hue: 20, sizeMb: 14.2 },
  { id: 1, name: '02_wagyu_slice.mp4', duration: 10, hue: 350, sizeMb: 11.8 },
  { id: 2, name: '03_wok_fire.mov', duration: 14, hue: 28, sizeMb: 18.5 },
  { id: 3, name: '04_garnish_drizzle.mp4', duration: 12, hue: 95, sizeMb: 13.9 },
]
export const SCRIPTS: Record<number, string> = {
  0: 'Hidden alleys of Tokyo with mouth-watering skewers sizzling over charcoal at midnight.',
  1: 'Just look at this unbelievable A5 Wagyu marbling right here in Shinjuku alleyways.',
  2: 'The chef flares up the wok with extreme precision, and that smoky wok hei changes everything.',
  3: 'Tell me in the comments: would you try this dish?',
}
export const TAGS: Record<number, string[]> = {
  0: ['Charcoal Fire', 'Yakitori'], 1: ['A5 Wagyu', 'Knife', 'Marbling'], 2: ['Flames', 'Wok Toss'], 3: ['Garnish', 'Plating'],
}
export const PROJECTS = [
  { name: 'Tokyo Street Food Tour', scenes: 4, dur: '00:48', status: 'Completed', mod: '12m ago', hue: 20 },
  { name: 'Fitness Morning Routine', scenes: 5, dur: '00:32', status: 'Script ready', mod: '3h ago', hue: 200 },
  { name: 'Crypto AI News Daily', scenes: 3, dur: '00:59', status: 'Draft', mod: '1d ago', hue: 190 },
]
export const VOICES = ['Rachel (Storyteller)', 'Adam (Deep Hype)', 'Antoni (Tech Explainer)']
