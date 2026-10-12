'use client'
import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Tag, message } from 'antd'
import { useStore } from '@/lib/store'

export default function Settings() {
  const { keys, set } = useStore(), [st, setSt] = useState<Record<string, number>>({}), [api, ctx] = message.useMessage()
  const test = (k: 'gemini' | 'eleven') => {
    const ok = k === 'gemini' ? /^AIza[\w-]{20,}$/.test(keys[k]) : /^[\w-]{20,}$/.test(keys[k])
    setSt({ ...st, [k]: ok ? 1 : 2 })
    if (ok) api.success('Key format looks valid'); else api.error('Key format not recognized')
  }
  return (
    <div style={{ padding: 16, maxWidth: 560 }}>{ctx}
      <Card title="AI provider keys">
        <Alert type="info" showIcon message="Prototype only: keys live in memory. In production, keep them in server env vars (see .env.example) and call providers from app/api routes." />
        <Form layout="vertical">
          {([['gemini', 'Gemini API key'], ['eleven', 'ElevenLabs API key']] as const).map(([k, l]) => (
            <Form.Item key={k} label={<>{l} {st[k] === 1 && <Tag color="success">Valid</Tag>}{st[k] === 2 && <Tag color="error">Invalid</Tag>}</>}>
              <Input.Password value={keys[k]} onChange={(e) => set({ keys: { ...keys, [k]: e.target.value } })} addonAfter={<Button type="link" size="small" onClick={() => test(k)}>Save &amp; test</Button>} />
            </Form.Item>
          ))}
        </Form>
      </Card>
    </div>
  )
}
