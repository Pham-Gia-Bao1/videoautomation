'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Empty, List, Progress, Tag, Typography, message } from 'antd'
import { CloudUploadOutlined, DeleteOutlined, FileOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import StepFooter from '@/components/StepFooter'
import { fmt } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useStore } from '@/lib/store'

type Scene = {
  id: string
  name: string
  asset_path: string | null
  duration_seconds: number
  sort_order: number
}

const MAX_FILE_SIZE = 500 * 1024 * 1024
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']

function readDuration(file: File) {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(video.duration) ? video.duration : 0)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    video.src = url
  })
}

export default function Upload() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    const queryId = new URLSearchParams(window.location.search).get('projectId')
    const id = queryId || sessionStorage.getItem('clipforge.activeProjectId') || ''
    setProjectId(id)
    if (id) useStore.setState({ activeProjectId: id })
    setProjectName(sessionStorage.getItem('clipforge.activeProjectName') || '')
    if (!id || !isSupabaseConfigured) setLoading(false)
  }, [])

  const loadScenes = useCallback(async () => {
    if (!projectId || !isSupabaseConfigured) return
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/scenes`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not load project videos.')
      setScenes(body.scenes || [])
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load project videos.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void loadScenes() }, [loadScenes])

  async function uploadFiles(fileList: FileList | File[]) {
    if (!projectId || uploading) return
    const files = Array.from(fileList)
    const invalid = files.find((file) => !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE)
    if (invalid) {
      messageApi.error(`${invalid.name} is not supported. Choose MP4, MOV, or WebM under 500 MB.`)
      return
    }
    if (!files.length) return

    setUploading(true)
    setProgress(0)
    setError('')
    const supabase = createClient()
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Your session expired. Sign in again to upload.')
      const firstOrder = scenes.reduce((highest, scene) => Math.max(highest, scene.sort_order), -1) + 1

      for (const [index, file] of files.entries()) {
        const safeName = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-160) || 'video.mp4'
        const assetPath = `${user.id}/${projectId}/${crypto.randomUUID()}-${safeName}`
        const { error: storageError } = await supabase.storage.from('video-assets').upload(assetPath, file, {
          contentType: file.type,
          upsert: false,
        })
        if (storageError) throw new Error(storageError.message)

        const duration = await readDuration(file)
        const response = await fetch(`/api/projects/${projectId}/scenes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            asset_path: assetPath,
            asset_size_bytes: file.size,
            content_type: file.type,
            duration_seconds: duration,
            sort_order: firstOrder + index,
          }),
        })
        const body = await response.json()
        if (!response.ok) {
          await supabase.storage.from('video-assets').remove([assetPath])
          throw new Error(body.error || `Could not save ${file.name}.`)
        }
        setScenes((current) => [...current, body.scene])
        const currentEditor = useStore.getState()
        const clipId = currentEditor.clips.length
        useStore.setState({
          clips: [...currentEditor.clips, {
            id: clipId, sceneId: body.scene.id, name: body.scene.name,
            duration, hue: (clipId * 67 + 142) % 360, sizeMb: file.size / (1024 * 1024),
          }],
          scripts: { ...currentEditor.scripts, [clipId]: '' },
          voice: [...currentEditor.voice, 0],
          analyze: 0,
          render: 0,
        })
        setProgress(Math.round(((index + 1) / files.length) * 100))
      }
      messageApi.success(`${files.length} ${files.length === 1 ? 'video' : 'videos'} added to the project.`)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Try again.')
      void loadScenes()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removeScene(scene: Scene) {
    const response = await fetch(`/api/scenes/${scene.id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json()
      messageApi.error(body.error || 'Could not remove video.')
      return
    }
    setScenes((current) => current.filter((item) => item.id !== scene.id))
    const currentEditor = useStore.getState()
    const keptClips = currentEditor.clips.filter((clip) => clip.sceneId !== scene.id)
    const scripts = Object.fromEntries(keptClips.map((clip, index) => [index, currentEditor.scripts[clip.id] || '']))
    const voice = keptClips.map((clip) => currentEditor.voice[clip.id] ?? 0)
    useStore.setState({
      clips: keptClips.map((clip, index) => ({ ...clip, id: index })),
      scripts, voice, sel: 0, analyze: 0, render: 0,
    })
    messageApi.success('Video removed.')
  }

  const totalSeconds = scenes.reduce((sum, scene) => sum + Number(scene.duration_seconds || 0), 0)

  if (!projectId) {
    return (
      <main className="page-wrap">
        <Alert type="info" showIcon message="Choose a project before uploading" description="Video files are stored privately inside a project." action={<Button type="primary" onClick={() => router.push('/projects')}>Browse projects</Button>} />
      </main>
    )
  }

  return (
    <>
      {contextHolder}
      <main className="page-wrap fade-up" style={{ flex: 1 }}>
        <header className="page-heading">
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>PROJECT MEDIA</Typography.Text>
            <h1>{projectName || 'Upload footage'}</h1>
            <p>Add source clips. Files upload directly to your private Supabase storage.</p>
          </div>
          <Button icon={<FolderOpenOutlined />} onClick={() => router.push('/projects')}>All projects</Button>
        </header>

        {!isSupabaseConfigured && <Alert type="warning" showIcon message="Supabase is not configured" description="Add the project URL and anon key to .env.local before uploading." style={{ marginBottom: 18 }} />}
        {error && <Alert type="error" showIcon message={error} closable onClose={() => setError('')} style={{ marginBottom: 18 }} />}

        <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" multiple hidden onChange={(event) => event.target.files && void uploadFiles(event.target.files)} />
        <div
          className={`upload-zone${dragging ? ' is-dragging' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadFiles(event.dataTransfer.files) }}
        >
          <div>
            <CloudUploadOutlined style={{ color: 'var(--green)', fontSize: 30 }} />
            <Typography.Title level={4} style={{ margin: '12px 0 4px' }}>Drop video clips here</Typography.Title>
            <Typography.Text type="secondary">MP4, MOV or WebM · up to 500 MB each</Typography.Text>
            <div style={{ marginTop: 16 }}><Button type="primary" icon={<FileOutlined />} loading={uploading} disabled={!isSupabaseConfigured}>Choose videos</Button></div>
          </div>
        </div>
        {uploading && <Progress percent={progress} status="active" style={{ marginTop: 16 }} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '28px 0 12px' }}>
          <Typography.Title level={5} style={{ margin: 0 }}>Source clips <Tag>{scenes.length}</Tag></Typography.Title>
          <Typography.Text type="secondary">{fmt(totalSeconds)}</Typography.Text>
        </div>
        {loading ? <Card loading /> : scenes.length ? (
          <Card styles={{ body: { padding: 0 } }}>
            <List
              dataSource={scenes}
              renderItem={(scene, index) => (
                <List.Item actions={[
                  <Button key="remove" type="text" danger icon={<DeleteOutlined />} aria-label={`Remove ${scene.name}`} title="Remove clip" disabled={uploading} onClick={() => void removeScene(scene)} />,
                ]}>
                  <List.Item.Meta
                    avatar={<div className="brand-mark" style={{ background: 'var(--canvas)', color: 'var(--green-dark)' }}>{String(index + 1).padStart(2, '0')}</div>}
                    title={scene.name}
                    description={`${fmt(Number(scene.duration_seconds) || 0)} · ${scene.asset_path ? 'Stored securely' : 'No source file'}`}
                  />
                  <Tag color="success">Ready</Tag>
                </List.Item>
              )}
            />
          </Card>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No source clips yet" />}
      </main>
      <StepFooter disabled={!scenes.length || uploading} hint={`${scenes.length} clips · ${fmt(totalSeconds)}`} />
    </>
  )
}
