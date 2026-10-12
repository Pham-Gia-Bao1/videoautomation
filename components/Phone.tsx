'use client'
import { Clip } from '@/lib/mock'
import { useStore } from '@/lib/store'
const STYLE: Record<string, React.CSSProperties> = {
  TikTok: { fontWeight: 900, textTransform: 'uppercase', color: '#ffb693', background: '#0b0e13cc', padding: '4px 10px', borderRadius: 10 },
  Clean: { fontWeight: 500, color: '#fff', background: '#272a2fe6', padding: '2px 10px' },
  Bold: { fontWeight: 800, textTransform: 'uppercase', color: '#fff', background: '#93000ae6', padding: '2px 10px' },
  Minimal: { fontWeight: 400, color: '#ddd', background: '#0b0e1380', padding: '1px 8px' },
}
export default function Phone({ clip, caption, w = 240 }: { clip: Clip; caption: string; w?: number }) {
  const { captionStyle, captionSize } = useStore()
  return (
    <div style={{ width: w, aspectRatio: '9/16', borderRadius: 6, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,hsl(${clip.hue} 45% 34%),hsl(${(clip.hue + 40) % 360} 50% 12%))` }}>
      <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, opacity: 0.7 }}>{clip.name}</span>
      <div style={{ textAlign: 'center', fontSize: (captionSize * w) / 360, lineHeight: 1.2, margin: 12, ...STYLE[captionStyle] }}>{caption}</div>
    </div>
  )
}
