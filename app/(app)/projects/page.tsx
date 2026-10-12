'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Input, Modal, Skeleton, Tag, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, FolderOpenOutlined, PlusOutlined, VideoCameraAddOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useStore } from '@/lib/store'

type Project = {
  id: string
  name: string
  status: 'draft' | 'processing' | 'completed' | 'archived'
  aspect_ratio: string
  created_at: string
  updated_at: string
  scenes: { count: number }[]
}

function getError(payload: { error?: string }, fallback: string) {
  return payload.error || fallback
}

export default function Projects() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [busy, setBusy] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const loadProjects = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/projects', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(getError(body, 'Could not load projects.'))
      setProjects(body.projects || [])
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load projects.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadProjects() }, [loadProjects])

  const visibleProjects = useMemo(() => projects.filter((project) =>
    project.name.toLowerCase().includes(search.toLowerCase().trim()),
  ), [projects, search])

  function openProject(project: Project) {
    sessionStorage.setItem('clipforge.activeProjectId', project.id)
    sessionStorage.setItem('clipforge.activeProjectName', project.name)
    useStore.setState({ activeProjectId: project.id })
    router.push(`/upload?projectId=${encodeURIComponent(project.id)}`)
  }

  async function createProject() {
    const name = projectName.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, aspect_ratio: '9:16' }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(getError(body, 'Could not create project.'))
      sessionStorage.setItem('clipforge.activeProjectId', body.project.id)
      sessionStorage.setItem('clipforge.activeProjectName', body.project.name)
      useStore.setState({ activeProjectId: body.project.id })
      router.push(`/upload?projectId=${encodeURIComponent(body.project.id)}`)
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Could not create project.')
    } finally {
      setBusy(false)
    }
  }

  function renameProject(project: Project) {
    let name = project.name
    Modal.confirm({
      title: 'Rename project',
      content: <Input autoFocus maxLength={100} defaultValue={project.name} onChange={(event) => { name = event.target.value }} />,
      okText: 'Save',
      onOk: async () => {
        const response = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(getError(body, 'Could not rename project.'))
        const normalizedName = name.trim()
        if (sessionStorage.getItem('clipforge.activeProjectId') === project.id) sessionStorage.setItem('clipforge.activeProjectName', normalizedName)
        setProjects((current) => current.map((item) => item.id === project.id ? { ...item, name: normalizedName } : item))
        messageApi.success('Project renamed.')
      },
    })
  }

  function deleteProject(project: Project) {
    Modal.confirm({
      title: `Delete “${project.name}”?`,
      content: 'This permanently removes its scenes and uploaded video files.',
      okText: 'Delete project',
      okButtonProps: { danger: true },
      onOk: async () => {
        const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
        if (!response.ok) {
          const body = await response.json()
          throw new Error(getError(body, 'Could not delete project.'))
        }
        setProjects((current) => current.filter((item) => item.id !== project.id))
        if (sessionStorage.getItem('clipforge.activeProjectId') === project.id) {
          sessionStorage.removeItem('clipforge.activeProjectId')
          sessionStorage.removeItem('clipforge.activeProjectName')
        }
        messageApi.success('Project deleted.')
      },
    })
  }

  return (
    <main className="page-wrap fade-up">
      {contextHolder}
      <header className="page-heading">
        <div>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>YOUR WORKSPACE</Typography.Text>
          <h1>Projects</h1>
          <p>Pick up an edit or start a new story.</p>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} disabled={!isSupabaseConfigured} onClick={() => { setProjectName(''); setCreateOpen(true) }}>New project</Button>
      </header>

      {!isSupabaseConfigured && <Alert type="warning" showIcon message="Connect Supabase to start saving projects" description="Add the Supabase URL and anon key to .env.local, then apply the SQL migration in supabase/migrations." style={{ marginBottom: 20 }} />}
      {loadError && <Alert type="error" showIcon message={loadError} action={<Button size="small" onClick={() => void loadProjects()}>Retry</Button>} style={{ marginBottom: 20 }} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <Typography.Text strong>{loading ? 'Loading projects…' : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}</Typography.Text>
        <Input.Search allowClear placeholder="Find a project" value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 300 }} />
      </div>

      {loading ? <div className="project-grid">{[0, 1, 2].map((key) => <Skeleton key={key} active paragraph={{ rows: 3 }} />)}</div> : visibleProjects.length ? (
        <section className="project-grid" aria-label="Your projects">
          {visibleProjects.map((project, index) => (
            <article key={project.id} className="project-tile fade-up" style={{ animationDelay: `${index * 50}ms` }}>
              <button type="button" className="project-art" onClick={() => openProject(project)} aria-label={`Open ${project.name}`}>
                <span className="project-art-label">{project.aspect_ratio} · ClipForge edit</span>
              </button>
              <div className="project-info">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 title={project.name}>{project.name}</h3>
                  <Tag color={project.status === 'completed' ? 'success' : project.status === 'processing' ? 'processing' : 'default'}>{project.status}</Tag>
                </div>
                <div className="project-meta">
                  <span>{project.scenes?.[0]?.count ?? 0} scenes · Edited {new Date(project.updated_at).toLocaleDateString()}</span>
                  <span style={{ display: 'flex', gap: 4 }}>
                    <Button type="text" size="small" icon={<FolderOpenOutlined />} aria-label="Open project" title="Open project" onClick={() => openProject(project)} />
                    <Button type="text" size="small" icon={<EditOutlined />} aria-label="Rename project" title="Rename project" onClick={() => renameProject(project)} />
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Delete project" title="Delete project" onClick={() => deleteProject(project)} />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search ? 'No matching projects' : 'Your next story starts here'}>
          {!search && isSupabaseConfigured && <Button type="primary" icon={<VideoCameraAddOutlined />} onClick={() => { setProjectName(''); setCreateOpen(true) }}>Create your first project</Button>}
        </Empty>
      )}

      <Modal title="Start a new edit" open={createOpen} okText="Create project" confirmLoading={busy} okButtonProps={{ disabled: !projectName.trim() }} onCancel={() => setCreateOpen(false)} onOk={() => void createProject()}>
        <Typography.Paragraph type="secondary">Give this video a working title. You can change it later.</Typography.Paragraph>
        <Input autoFocus maxLength={100} showCount placeholder="e.g. Weekend in Kyoto" value={projectName} onChange={(event) => setProjectName(event.target.value)} onPressEnter={() => void createProject()} />
      </Modal>
    </main>
  )
}
