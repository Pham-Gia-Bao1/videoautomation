export default function Thumb({ hue, h = 64, label }: { hue: number; h?: number; label?: string }) {
  return (
    <div style={{ height: h, borderRadius: 4, position: 'relative', background: `linear-gradient(135deg,hsl(${hue} 45% 34%),hsl(${(hue + 40) % 360} 50% 12%))` }}>
      {label && <span style={{ position: 'absolute', left: 6, bottom: 4, fontSize: 10, opacity: 0.7 }}>{label}</span>}
    </div>
  )
}
