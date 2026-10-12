'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Descriptions, Progress, Steps, Typography, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { fmt, total, useStore } from '@/lib/store'

const PIPE = ['Merge video clips', 'Normalize video format', 'Generate audio track', 'Synchronize voice', 'Generate subtitles', 'Encode 1080 × 1920', 'Finalize MP4']
type Job = { id: string; status: 'queued' | 'processing' | 'completed' | 'failed'; progress: number; output_url?: string | null; error?: string | null }

export default function Render() {
  const router = useRouter()
  const { render, clips, activeProjectId } = useStore()
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const startedForProject = useRef<string | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const done = job?.status === 'completed' && Boolean(job.output_url)
  const percent = job?.progress ?? render
  const k = Math.min(PIPE.length, Math.floor(percent / (100 / PIPE.length)))

  const pollJob = useCallback(async (id: string) => {
    const response = await fetch(`/api/render?jobId=${encodeURIComponent(id)}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Could not read render status.')
    setJob(body.job)
    useStore.setState({ render: body.job.progress })
    if (body.job.status === 'completed') {
      if (!body.job.output_url) throw new Error('The render worker completed without returning an output URL.')
      messageApi.success('Your video is ready to download.')
    }
    if (body.job.status === 'failed') throw new Error(body.job.error || 'Render failed.')
  }, [messageApi])

  const startRender = useCallback(async () => {
    if (!activeProjectId || starting) return
    setStarting(true)
    setError('')
    try {
      const response = await fetch('/api/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not start rendering.')
      setJob(body.job)
      sessionStorage.setItem(`clipforge.renderJobId:${activeProjectId}`, body.job.id)
      useStore.setState({ render: 0 })
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Could not start rendering.')
    } finally {
      setStarting(false)
    }
  }, [activeProjectId, starting])

  useEffect(() => {
    if (!activeProjectId || startedForProject.current === activeProjectId) return
    startedForProject.current = activeProjectId
    const savedJobId = sessionStorage.getItem(`clipforge.renderJobId:${activeProjectId}`)
    if (savedJobId) {
      void pollJob(savedJobId).catch((pollError) => setError(pollError instanceof Error ? pollError.message : 'Could not load render job.'))
    } else {
      void startRender()
    }
  }, [activeProjectId, pollJob, startRender])

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return
    const timer = window.setInterval(() => {
      void pollJob(job.id).catch((pollError) => setError(pollError instanceof Error ? pollError.message : 'Could not read render status.'))
    }, 3000)
    return () => window.clearInterval(timer)
  }, [job, pollJob])

  return (
    <>
      {contextHolder}
    <div style={{ flex: 1, overflow: 'auto', padding: 16, maxWidth: 720, width: '100%', margin: '0 auto' }}>
      <Typography.Title level={3}>{done ? 'Render complete' : job?.status === 'failed' ? 'Render needs attention' : 'Rendering your video'}</Typography.Title>
      <Typography.Paragraph type="secondary">Your source files stay private while the render worker combines video, voice, and captions.</Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => { if (activeProjectId) sessionStorage.removeItem(`clipforge.renderJobId:${activeProjectId}`); setJob(null); setError(''); void startRender() }}>Retry</Button>} />}
      {!activeProjectId && <Alert type="info" showIcon message="Open a project before rendering." action={<Button onClick={() => router.push('/projects')}>Projects</Button>} style={{ marginBottom: 16 }} />}
      {job?.status === 'completed' && job.output_url && <Alert type="success" showIcon message="Your export is ready" action={<Button type="primary" href={job.output_url} target="_blank" rel="noreferrer">Download video</Button>} style={{ marginBottom: 16 }} />}
      <Progress percent={percent} status={done ? 'success' : job?.status === 'failed' ? 'exception' : starting || job ? 'active' : 'normal'} />
      <Steps direction="vertical" size="small" current={k} items={PIPE.map((title, index) => ({ title, status: done ? 'finish' : index < k ? 'finish' : index === k ? 'process' : 'wait' }))} />
      <Descriptions size="small" column={2} items={[{ label: 'Resolution', children: '1080 × 1920' }, { label: 'Frame rate', children: '30 FPS' }, { label: 'Codec', children: 'H.264 / AAC' }, { label: 'Duration', children: fmt(total(clips)) }]} />
    </div>
    </>
  )
}
