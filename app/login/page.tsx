'use client'

import { useState } from 'react'
import { Alert, Button, Form, Input, Segmented, Typography, message } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/client'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<'Sign in' | 'Create account'>('Sign in')
  const [busy, setBusy] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  async function submit(values: { email: string; password: string }) {
    if (!isSupabaseConfigured) return
    setBusy(true)
    const supabase = createClient()
    const result = mode === 'Sign in'
      ? await supabase.auth.signInWithPassword(values)
      : await supabase.auth.signUp({
          ...values,
          options: {
            emailRedirectTo: new URL('/auth/callback', process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).toString(),
          },
        })
    setBusy(false)

    if (result.error) {
      messageApi.error(result.error.message)
      return
    }
    if (mode === 'Create account' && !result.data.session) {
      messageApi.success('Check your email to confirm your account, then sign in.')
      setMode('Sign in')
      return
    }
    const next = new URLSearchParams(window.location.search).get('next')
    router.replace(next?.startsWith('/') && !next.startsWith('//') ? next : '/projects')
    router.refresh()
  }

  return (
    <main className="auth-layout">
      {contextHolder}
      <section className="auth-visual">
        <div className="brand-lockup"><div className="brand-mark">C</div><span className="brand-name">ClipForge</span></div>
        <div className="fade-up">
          <h2 className="auth-title">Make every second <em>count.</em></h2>
          <p className="auth-copy">Shape your footage into short-form stories, from first cut to final frame.</p>
        </div>
        <Typography.Text style={{ color: 'rgba(255,255,255,.56)' }}>A calmer way to make videos.</Typography.Text>
      </section>
      <section className="auth-panel">
        <div className="auth-form fade-up">
          <h1>{mode === 'Sign in' ? 'Welcome back' : 'Create your account'}</h1>
          <p>Sign in to pick up where your edit left off.</p>
          {!isSupabaseConfigured && (
            <Alert
              type="warning"
              showIcon
              message="Supabase setup required"
              description="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then apply the SQL migration."
              style={{ marginBottom: 20 }}
            />
          )}
          <Segmented block value={mode} options={['Sign in', 'Create account']} onChange={(value) => setMode(value as typeof mode)} style={{ marginBottom: 24 }} />
          <Form layout="vertical" onFinish={submit} requiredMark={false}>
            <Form.Item name="email" label="Email address" rules={[{ required: true }, { type: 'email' }]}>
              <Input size="large" autoComplete="email" placeholder="you@example.com" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true }, { min: 8, message: 'Use at least 8 characters.' }]}>
              <Input.Password size="large" autoComplete={mode === 'Sign in' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" />
            </Form.Item>
            <Button block size="large" type="primary" htmlType="submit" loading={busy} disabled={!isSupabaseConfigured} icon={<ArrowRightOutlined />} iconPosition="end">
              {mode === 'Sign in' ? 'Sign in' : 'Create account'}
            </Button>
          </Form>
        </div>
      </section>
    </main>
  )
}