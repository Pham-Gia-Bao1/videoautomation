'use client'
import { useState } from 'react'
import { Alert, Button, Card, Col, List, Progress, Row, Select, Slider, Tag, Typography, message } from 'antd'
import { SoundOutlined } from '@ant-design/icons'
import StepFooter from '@/components/StepFooter'
import { useStore } from '@/lib/store'

const VOICES = [
  { value: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel · Storyteller' },
  { value: 'pNInz6obpgDQGcFmaJgB', label: 'Adam · Deep voice' },
  { value: 'ErXwobaYiN019PkySvjV', label: 'Antoni · Explainer' },
]

export default function Voice() {
  const { clips, voice, scripts } = useStore()
  const [voiceId, setVoiceId] = useState(VOICES[0].value)
  const [stability, setStability] = useState(0.5)
  const [similarity, setSimilarity] = useState(0.75)
  const [speed, setSpeed] = useState(1)
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState(0)
  const [error, setError] = useState('')
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({})
  const [messageApi, contextHolder] = message.useMessage()
  const all = clips.every((_, i) => (voice[i] ?? 100) >= 100)

  async function generateAll() {
    const scenes = clips.filter((clip) => clip.sceneId && scripts[clip.id]?.trim())
    if (!scenes.length || busy) return
    setBusy(true)
    setError('')
    const progress = [...voice]
    let failed = false
    for (const clip of scenes) {
      setCurrent(clip.id)
      progress[clip.id] = 15
      useStore.setState({ voice: [...progress] })
      try {
        const response = await fetch('/api/voice', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneId: clip.sceneId, text: scripts[clip.id], voiceId, stability, similarity, speed,
          }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || `Could not generate voice for ${clip.name}.`)
        setAudioUrls((currentUrls) => ({ ...currentUrls, [clip.sceneId!]: body.audioUrl }))
        progress[clip.id] = 100
        useStore.setState({ voice: [...progress] })
      } catch (generationError) {
        progress[clip.id] = 0
        useStore.setState({ voice: [...progress] })
        setError(generationError instanceof Error ? generationError.message : `Could not generate voice for ${clip.name}.`)
        failed = true
        break
      }
    }
    setBusy(false)
    if (!failed) messageApi.success('Voice audio is saved to your project.')
  }

  async function loadAudio(sceneId: string) {
    const response = await fetch(`/api/scenes/${sceneId}/audio`)
    const body = await response.json()
    if (!response.ok) {
      messageApi.error(body.error || 'Could not load audio.')
      return
    }
    setAudioUrls((currentUrls) => ({ ...currentUrls, [sceneId]: body.audioUrl }))
  }

  return (
    <>
      {contextHolder}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}><Row gutter={12}>
        <Col xs={24} md={9}><Card size="small" title="Voice configuration">
          <Typography.Text>Voice</Typography.Text><Select value={voiceId} onChange={setVoiceId} options={VOICES} style={{ width: '100%', margin: '6px 0 14px' }} />
          <Typography.Text>Stability · {Math.round(stability * 100)}%</Typography.Text><Slider min={0} max={1} step={0.05} value={stability} onChange={setStability} />
          <Typography.Text>Similarity · {Math.round(similarity * 100)}%</Typography.Text><Slider min={0} max={1} step={0.05} value={similarity} onChange={setSimilarity} />
          <Typography.Text>Speed · {speed.toFixed(2)}×</Typography.Text><Slider min={0.7} max={1.2} step={0.05} value={speed} onChange={setSpeed} />
          <Button block type="primary" icon={<SoundOutlined />} loading={busy} disabled={!clips.some((clip) => clip.sceneId && scripts[clip.id]?.trim())} onClick={() => void generateAll()}>
            {busy ? `Generating scene ${current + 1}` : 'Generate voice tracks'}
          </Button>
        </Card></Col>
        <Col xs={24} md={15}>
          {error && <Alert type="error" showIcon message={error} closable onClose={() => setError('')} style={{ marginBottom: 12 }} />}
          <Card size="small" title={all ? 'Voice tracks ready' : 'Scene voice tracks'}>
          <List dataSource={clips} renderItem={(c, i) => {
            const v = voice[i] ?? 100
            return (
              <List.Item>
                <List.Item.Meta title={`Scene 0${i + 1} · ${c.name}`} description={scripts[c.id] || 'Add a script before generating voice.'} />
                <div style={{ minWidth: 150, display: 'grid', gap: 8 }}>
                  <Tag color={v >= 100 ? 'success' : v > 0 ? 'processing' : 'default'}>{v >= 100 ? 'Generated' : v > 0 ? 'Generating' : 'Not generated'}</Tag>
                  {c.sceneId && audioUrls[c.sceneId] ? <audio controls preload="none" src={audioUrls[c.sceneId]} /> : c.sceneId && <Button size="small" onClick={() => void loadAudio(c.sceneId!)}>Load audio</Button>}
                  {busy && current === c.id && <Progress percent={v} size="small" showInfo={false} />}
                </div>
              </List.Item>
            )
          }} />
        </Card></Col>
      </Row></div>
      <StepFooter disabled={!all || busy} hint={`${clips.filter((_, i) => (voice[i] ?? 100) >= 100).length} / ${clips.length} scenes generated`} />
    </>
  )
}
