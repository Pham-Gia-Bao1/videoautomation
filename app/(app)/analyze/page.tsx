'use client'

import { useState } from 'react'
import { Alert, Button, List, Progress, Tag, Typography, message } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import Thumb from '@/components/Thumb'
import StepFooter from '@/components/StepFooter'
import { useStore } from '@/lib/store'

type Analysis = { summary?: string; objects?: string[]; action?: string; mood?: string }

export default function Analyze() {
  const { clips, analyze, scripts } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Record<string, Analysis>>({})
  const [messageApi, contextHolder] = message.useMessage()
  const done = clips.length > 0 && analyze >= 100

  async function runAnalysis() {
    const eligible = clips.filter((clip) => clip.sceneId)
    if (!eligible.length || busy) return
    setBusy(true)
    setError('')
    setResults({})
    useStore.setState({ analyze: 0 })
    const nextScripts = { ...scripts }
    let completed = 0
    let failed = false
    for (const clip of eligible) {
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneId: clip.sceneId }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || `Could not analyze ${clip.name}.`)
        setResults((current) => ({ ...current, [clip.sceneId!]: body.analysis }))
        nextScripts[clip.id] = body.script
      } catch (analysisError) {
        setError(analysisError instanceof Error ? analysisError.message : `Could not analyze ${clip.name}.`)
        failed = true
        break
      } finally {
        completed += 1
        useStore.setState({ analyze: Math.round((completed / eligible.length) * 100) })
      }
    }
    useStore.setState({ scripts: nextScripts })
    setBusy(false)
    if (!failed) messageApi.success('Analysis results are saved to your project.')
  }

  return (
    <>
      {contextHolder}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, maxWidth: 760, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>{done ? 'Analysis complete' : 'Understand your footage'}</Typography.Title>
            <Typography.Text type="secondary">Gemini analyzes each uploaded clip and drafts a voiceover line.</Typography.Text>
          </div>
          <Button type="primary" icon={<PlayCircleOutlined />} loading={busy} disabled={!clips.some((clip) => clip.sceneId)} onClick={() => void runAnalysis()}>
            {busy ? 'Analyzing' : 'Analyze clips'}
          </Button>
        </div>
        {error && <Alert type="error" showIcon message={error} closable onClose={() => setError('')} style={{ marginBottom: 16 }} />}
        {!clips.length && <Alert type="info" showIcon message="Add source clips to this project before analyzing." style={{ marginBottom: 16 }} />}
        <Progress percent={analyze} status={done ? 'success' : busy ? 'active' : 'normal'} />
        <List dataSource={clips} renderItem={(clip, index) => {
          const result = clip.sceneId ? results[clip.sceneId] : undefined
          return (
            <List.Item extra={<Tag color={result ? 'success' : 'default'}>{result ? 'Analyzed' : 'Waiting'}</Tag>}>
              <List.Item.Meta
                avatar={<div style={{ width: 56 }}><Thumb hue={clip.hue} h={36} /></div>}
                title={`Scene 0${index + 1} · ${clip.name}`}
                description={result ? `${result.summary || result.action || ''}${result.objects?.length ? ` · ${result.objects.join(', ')}` : ''}${result.mood ? ` · ${result.mood}` : ''}` : 'Analysis results will appear here.'}
              />
            </List.Item>
          )
        }} />
      </div>
      <StepFooter disabled={!done || busy} hint={done ? 'Results saved' : 'Run analysis to continue'} />
    </>
  )
}
