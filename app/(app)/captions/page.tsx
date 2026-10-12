'use client'
import { useState } from 'react'
import { Card, Col, Input, Row, Segmented, Slider } from 'antd'
import Phone from '@/components/Phone'
import StepFooter from '@/components/StepFooter'
import { useStore } from '@/lib/store'

export default function Captions() {
  const { clips, scripts, captionStyle, captionSize, set } = useStore()
  const [i, setI] = useState(0), c = clips[Math.min(i, clips.length - 1)]
  const [caps, setCaps] = useState<Record<number, string>>({})
  const text = caps[c.id] ?? (scripts[c.id] ?? '').split('.')[0]
  return (
    <>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}><Row gutter={12}>
        <Col xs={24} md={14}><Card size="small" title="Caption settings">
          <Segmented block options={['TikTok', 'Clean', 'Bold', 'Minimal']} value={captionStyle} onChange={(v) => set({ captionStyle: String(v) })} />
          <div style={{ margin: '12px 0 4px' }}>Size: {captionSize}px</div><Slider min={16} max={40} value={captionSize} onChange={(v) => set({ captionSize: v })} />
          <div style={{ margin: '12px 0 4px' }}>Segment</div>
          <Segmented options={clips.map((_, j) => ({ label: `Caption 0${j + 1}`, value: j }))} value={i} onChange={(v) => setI(Number(v))} />
          <Input value={text} onChange={(e) => setCaps({ ...caps, [c.id]: e.target.value })} />
        </Card></Col>
        <Col xs={24} md={10}><div style={{ display: 'flex', justifyContent: 'center' }}><Phone clip={c} caption={text} w={260} /></div></Col>
      </Row></div>
      <StepFooter hint={`${clips.length} captions`} onNext={() => useStore.setState({ render: 0 })} />
    </>
  )
}
