'use client'
import { useState } from 'react'
import { Button, Card, Col, Input, List, Row, Space, Tag } from 'antd'
import StepFooter from '@/components/StepFooter'
import Thumb from '@/components/Thumb'
import { SCRIPTS, TAGS } from '@/lib/mock'
import { fmt, useStore } from '@/lib/store'

export default function Script() {
  const { clips, scripts, set } = useStore()
  const [i, setI] = useState(0)
  const c = clips[Math.min(i, clips.length - 1)], text = scripts[c.id] ?? '', words = text.trim().split(/\s+/).filter(Boolean).length
  const edit = (t: string) => set({ scripts: { ...scripts, [c.id]: t } })
  const ops: Record<string, () => string> = {
    Regenerate: () => SCRIPTS[c.id] ?? text, Shorten: () => text.split(/\s+/).slice(0, 9).join(' ').replace(/[.,!?]$/, '') + '.',
    Expand: () => text + ' Trust me, the details make all the difference.', Rewrite: () => "Here's the trick: " + text.charAt(0).toLowerCase() + text.slice(1),
  }
  return (
    <>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}><Row gutter={12}>
        <Col xs={24} md={6}><Card size="small" title="Scenes"><List dataSource={clips} renderItem={(x, j) => (
          <List.Item onClick={() => setI(j)}><div style={{ width: 44 }}><Thumb hue={x.hue} h={30} /></div><div style={{ flex: 1 }}>Scene 0{j + 1}<br /><small>{fmt(x.duration)}</small></div><Tag color="success">Ready</Tag></List.Item>
        )} /></Card></Col>
        <Col xs={24} md={12}><Card size="small" title={`Scene 0${i + 1} · Voice script`} extra={`${words} words · ${text.length} chars`}>
          <Input.TextArea rows={6} value={text} onChange={(e) => edit(e.target.value)} />
          <Space wrap>{Object.keys(ops).map((k) => <Button key={k} onClick={() => edit(ops[k]())}>{k}</Button>)}<Button type="primary">Save Script</Button></Space>
        </Card></Col>
        <Col xs={24} md={6}><Card size="small" title="AI Scene Analysis">
          <div style={{ marginBottom: 8 }}>{(TAGS[c.id] ?? []).map((t) => <Tag key={t}>{t}</Tag>)}</div>
          <div>Mood: Casual / energetic</div><div>Tone: Friendly</div><div>Confidence: 94%</div>
        </Card></Col>
      </Row></div>
      <StepFooter onNext={() => useStore.setState((s) => ({ voice: s.clips.map(() => 100) }))} />
    </>
  )
}
