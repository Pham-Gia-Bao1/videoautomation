'use client'
import { Button, Space } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { usePathname, useRouter } from 'next/navigation'
import { STEPS, stepIndex } from '@/lib/mock'

export default function StepFooter({ disabled, hint, onNext }: { disabled?: boolean; hint?: string; onNext?: () => void }) {
  const router = useRouter(), i = stepIndex(usePathname()), cur = STEPS[i], prev = STEPS[i - 1]
  const next = i === 5 ? 'render' : STEPS[i + 1]?.key
  return (
    <div className="workflow-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <Button disabled={!prev} onClick={() => router.push(`/${prev.key}`)}>Back{prev ? ` to ${prev.title}` : ''}</Button>
      <Space>
        <span style={{ color: 'var(--muted)' }}>{hint}</span>
        <Button type="primary" disabled={disabled || !cur.cta} icon={<ArrowRightOutlined />} iconPosition="end" onClick={() => { onNext?.(); router.push(`/${next}`) }}>{cur.cta}</Button>
      </Space>
    </div>
  )
}
