import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

type Context = { params: { projectId: string } }

export async function PUT(request: Request, { params }: Context) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: { order?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
  }
  if (!Array.isArray(body.order) || body.order.length > 500 || body.order.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'Order must be a list of at most 500 scene IDs.' }, { status: 400 })
  }
  const order = body.order as string[]
  if (new Set(order).size !== order.length) return NextResponse.json({ error: 'Scene IDs must be unique.' }, { status: 400 })

  const { data: scenes, error: scenesError } = await supabase.from('scenes')
    .select('id').eq('project_id', params.projectId).eq('user_id', user.id)
  if (scenesError) return NextResponse.json({ error: scenesError.message }, { status: 500 })
  const existingIds = new Set((scenes ?? []).map((scene) => scene.id))
  if (order.length !== existingIds.size || order.some((id) => !existingIds.has(id))) {
    return NextResponse.json({ error: 'Order must contain every scene in this project exactly once.' }, { status: 400 })
  }

  const updates = await Promise.all(order.map((id, sortOrder) => supabase.from('scenes')
    .update({ sort_order: sortOrder }).eq('id', id).eq('project_id', params.projectId).eq('user_id', user.id)))
  const failed = updates.find((result) => result.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}