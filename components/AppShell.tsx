'use client'
import { useEffect, useRef, useState } from 'react'
import { Layout, Menu, Steps, Button } from 'antd'
import { FolderOpenOutlined, VideoCameraOutlined, RobotOutlined, SoundOutlined, FontSizeOutlined, ExportOutlined, SettingOutlined, ThunderboltOutlined, LogoutOutlined } from '@ant-design/icons'
import { usePathname, useRouter } from 'next/navigation'
import { STEPS, stepIndex } from '@/lib/mock'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useStore } from '@/lib/store'

const NAV = [
  { key: '/projects', icon: <FolderOpenOutlined />, label: 'Projects' },
  { key: '/arrange', icon: <VideoCameraOutlined />, label: 'Video Editor' },
  { key: '/script', icon: <RobotOutlined />, label: 'AI Script' },
  { key: '/voice', icon: <SoundOutlined />, label: 'Voice' },
  { key: '/captions', icon: <FontSizeOutlined />, label: 'Captions' },
  { key: '/export', icon: <ExportOutlined />, label: 'Export' },
]
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter(), path = usePathname(), idx = stepIndex(path)
  const activeProjectId = useStore((state) => state.activeProjectId)
  const hydratedProject = useRef<string | null>(null)
  const [projectName, setProjectName] = useState('Make every second count')
  const active = path === '/upload' ? '/arrange' : path === '/analyze' ? '/script' : path === '/render' ? '/export' : path
  useEffect(() => {
    const storedId = sessionStorage.getItem('clipforge.activeProjectId')
    const projectId = activeProjectId || storedId
    if (projectId && projectId !== activeProjectId) {
      useStore.setState({ activeProjectId: projectId })
      return
    }
    if (!projectId || !isSupabaseConfigured) return

    let cancelled = false
    hydratedProject.current = null
    async function hydrateProject() {
      const [projectResponse, scenesResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`, { cache: 'no-store' }),
        fetch(`/api/projects/${projectId}/scenes`, { cache: 'no-store' }),
      ])
      if (!projectResponse.ok || !scenesResponse.ok) return
      const [{ project }, { scenes }] = await Promise.all([projectResponse.json(), scenesResponse.json()])
      if (cancelled) return

      setProjectName(project.name)
      sessionStorage.setItem('clipforge.activeProjectName', project.name)
      const saved = project.editor_state && typeof project.editor_state === 'object' ? project.editor_state : {}
      const sceneScripts = Object.fromEntries(scenes.map((scene: { script_text: string }, index: number) => [index, scene.script_text || '']))
      const clips = scenes.map((scene: { id: string; name: string; duration_seconds: number }, index: number) => ({
        id: index,
        sceneId: scene.id,
        name: scene.name,
        duration: Number(scene.duration_seconds) || 0,
        hue: (index * 67 + 142) % 360,
        sizeMb: 0,
      }))
      useStore.setState({
        clips,
        sel: Math.min(Number(saved.sel) || 0, Math.max(0, clips.length - 1)),
        scripts: saved.scripts && typeof saved.scripts === 'object' ? saved.scripts : sceneScripts,
        analyze: Number(saved.analyze) || 0,
        voice: Array.isArray(saved.voice) ? saved.voice : clips.map(() => 0),
        render: Number(saved.render) || 0,
        captionStyle: typeof saved.captionStyle === 'string' ? saved.captionStyle : 'TikTok',
        captionSize: Number(saved.captionSize) || 24,
      })
      hydratedProject.current = projectId
    }
    void hydrateProject().catch(() => undefined)
    return () => { cancelled = true }
  }, [activeProjectId])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = useStore.subscribe((state, previous) => {
      const projectId = state.activeProjectId
      if (!projectId || hydratedProject.current !== projectId || !isSupabaseConfigured) return
      if (state.clips === previous.clips && state.sel === previous.sel && state.scripts === previous.scripts && state.analyze === previous.analyze && state.voice === previous.voice && state.render === previous.render && state.captionStyle === previous.captionStyle && state.captionSize === previous.captionSize) return
      if (timer) clearTimeout(timer)

      const snapshot = {
        clips: state.clips, sel: state.sel, scripts: state.scripts, analyze: state.analyze,
        voice: state.voice, render: state.render, captionStyle: state.captionStyle, captionSize: state.captionSize,
      }
      const order = state.clips.map((clip) => clip.sceneId).filter((id): id is string => Boolean(id))
      timer = setTimeout(async () => {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editor_state: snapshot }),
        })
        if (order.length === state.clips.length && order.length) {
          await fetch(`/api/projects/${projectId}/scenes/reorder`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }),
          })
        }
      }, 650)
    })
    return () => { unsubscribe(); if (timer) clearTimeout(timer) }
  }, [])

  const signOut = async () => {
    if (isSupabaseConfigured) await createClient().auth.signOut()
    sessionStorage.removeItem('clipforge.activeProjectId')
    sessionStorage.removeItem('clipforge.activeProjectName')
    useStore.setState({ activeProjectId: null })
    router.replace('/login')
    router.refresh()
  }
  return (
    <Layout className="app-frame">
      <Layout.Header className="app-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">C</div>
          <b className="brand-name" style={{ cursor: 'pointer' }} onClick={() => router.push('/projects')}>ClipForge</b>
          <span className="topbar-project">{projectName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => router.push('/render')}>Render</Button>
          <Button icon={<LogoutOutlined />} aria-label="Sign out" title="Sign out" onClick={signOut} />
        </div>
      </Layout.Header>
      <div className="app-workspace">
        <Layout.Sider className="app-sidebar" width={218}>
          <Menu mode="inline" selectedKeys={[active]} items={[...NAV, { type: 'divider' }, { key: '/settings', icon: <SettingOutlined />, label: 'Settings' }]} onClick={(e) => router.push(e.key)} />
        </Layout.Sider>
        <Layout.Content className="app-main">
          {idx >= 0 && (
            <div className="steps-strip">
              <Steps size="small" current={idx} onChange={(i) => router.push(`/${STEPS[i].key}`)} items={STEPS.map((s, i) => ({ title: `0${i + 1} ${s.title}` }))} />
            </div>
          )}
          <div className="workflow-content">{children}</div>
        </Layout.Content>
      </div>
    </Layout>
  )
}
