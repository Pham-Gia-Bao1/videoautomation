'use client'
import { Button, Card, Col, Descriptions, List, Row, Space } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, DeleteOutlined } from '@ant-design/icons'
import Thumb from '@/components/Thumb'
import Phone from '@/components/Phone'
import StepFooter from '@/components/StepFooter'
import { fmt, total, useStore } from '@/lib/store'

const TRACKS = ['VIDEO', 'VOICE', 'CAPTIONS']
const BG = ['#272a2f', '#1f3a52', '#3b2f4f']
export default function Arrange() {
  const { clips, sel, scripts, set, move } = useStore()
  const c = clips[sel] ?? clips[0]
  if (!c) return <div style={{ padding: 24 }}>Timeline is empty. Import clips first.</div>
  return (
    <>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Row gutter={8} style={{ flex: 1 }}>
          <Col xs={24} md={6}>
            <Card size="small" title="Media Library">
              <List size="small" dataSource={clips} renderItem={(x, i) => (
                <List.Item onClick={() => set({ sel: i })}>
                  <div style={{ width: 44 }}><Thumb hue={x.hue} h={44} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div>{x.name}</div><small style={{ color: '#8d919b' }}>{fmt(x.duration)}</small></div>
                </List.Item>
              )} />
            </Card>
          </Col>
          <Col xs={24} md={12}><div style={{ display: 'flex', justifyContent: 'center' }}><Phone clip={c} caption={scripts[c.id].split('.')[0]} /></div></Col>
          <Col xs={24} md={6}>
            <Card size="small" title={`Clip ${sel + 1} Properties`}>
              <Descriptions size="small" column={1} items={[{ label: 'Filename', children: c.name }, { label: 'Duration', children: fmt(c.duration) }, { label: 'Resolution', children: '1080 × 1920' }, { label: 'Frame rate', children: '60 fps' }]} />
              <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={() => move(sel, -1)} />
                <Button icon={<ArrowRightOutlined />} onClick={() => move(sel, 1)} />
                <Button danger icon={<DeleteOutlined />} disabled={clips.length < 2} onClick={() => set({ clips: clips.filter((_, i) => i !== sel), sel: 0 })}>Delete</Button>
              </Space>
            </Card>
          </Col>
        </Row>
        <Card size="small" title={`Timeline · ${fmt(total(clips))}`}>
          {TRACKS.map((label, r) => (
            <div key={label} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <div style={{ width: 70, color: '#8d919b', fontSize: 11 }}>{label}</div>
              <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                {clips.map((x, i) => (
                  <div key={x.id} onClick={() => set({ sel: i })} style={{ flex: `${x.duration} 1 0`, minWidth: 0, padding: '6px 8px', borderRadius: 3, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', background: i === sel ? '#ff6b0033' : BG[r], outline: i === sel ? '1px solid #ff6b00' : undefined }}>
                    {r === 0 ? x.name.replace(/\.\w+$/, '') : r === 1 ? 'Voice' : 'Captions'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>
      </div>
      <StepFooter hint={`${clips.length} clips · ${fmt(total(clips))}`} onNext={() => useStore.setState({ analyze: 0 })} />
    </>
  )
}
