'use client'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Row, Space, Spin } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import Phone from '@/components/Phone'
import { fmt, total, useStore } from '@/lib/store'

export default function Export() {
  const router = useRouter(), { clips, scripts, activeProjectId } = useStore()
  const [outputUrl, setOutputUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeProjectId) {
      setLoading(false)
      return
    }
    const jobId = sessionStorage.getItem(`clipforge.renderJobId:${activeProjectId}`)
    if (!jobId) {
      setLoading(false)
      return
    }
    let cancelled = false
    fetch(`/api/render?jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load your export.')
        if (!cancelled) setOutputUrl(body.job.output_url || '')
      })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load your export.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeProjectId])

  if (!clips.length) return <div style={{ padding: 24 }}>Nothing to export yet.</div>
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <Row gutter={16}>
        <Col xs={24} md={9}><div style={{ display: 'flex', justifyContent: 'center' }}><Phone clip={clips[0]} caption={(scripts[clips[0].id] ?? '').split('.')[0]} w={260} /></div></Col>
        <Col xs={24} md={15}>
          <h2>{outputUrl ? 'Your video is ready' : 'Your export'}</h2>
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
          {loading ? <Spin /> : outputUrl ? <Card size="small"><Descriptions size="small" column={2} items={[{ label: 'Format', children: 'MP4' }, { label: 'Resolution', children: '1080 × 1920' }, { label: 'Aspect ratio', children: '9:16' }, { label: 'Duration', children: fmt(total(clips)) }]} /></Card> : <Alert type="info" showIcon message="No finished video yet" description="Complete a render job before downloading this project." style={{ marginBottom: 12 }} />}
          <Space wrap>
            {outputUrl && <Button type="primary" icon={<DownloadOutlined />} href={outputUrl} target="_blank" rel="noreferrer">Download MP4</Button>}
            <Button onClick={() => router.push('/arrange')}>Open in Editor</Button>
            <Button onClick={() => router.push('/projects')}>Create Another Video</Button>
          </Space>
        </Col>
      </Row>
    </div>
  )
}
