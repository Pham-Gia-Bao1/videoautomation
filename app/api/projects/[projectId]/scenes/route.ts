import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

type Context = { params: { projectId: string } }

async function authenticatedClient() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

export async function GET(_request: Request, { params }: Context) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const { supabase, user } = await authenticatedClient()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data, error } = await supabase
    .from('scenes')
    .select('id, project_id, name, asset_path, audio_path, asset_size_bytes, content_type, duration_seconds, sort_order, script_text, analysis, created_at, updated_at')
    .eq('project_id', params.projectId)
    .eq('user_id', user.id)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scenes: data })
}

export async function POST(request: Request, { params }: Context) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const { supabase, user } = await authenticatedClient()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  let body: { name?: unknown; asset_path?: unknown; asset_size_bytes?: unknown; content_type?: unknown; duration_seconds?: unknown; sort_order?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
  }
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 255) {
    return NextResponse.json({ error: 'Scene name must be between 1 and 255 characters.' }, { status: 400 })
  }
  const duration = Number(body.duration_seconds ?? 0)
  const sortOrder = Number(body.sort_order ?? 0)
  if (!Number.isFinite(duration) || duration < 0 || !Number.isInteger(sortOrder) || sortOrder < 0) {
    return NextResponse.json({ error: 'Scene duration and order must be non-negative numbers.' }, { status: 400 })
  }
  const assetPath = typeof body.asset_path === 'string' ? body.asset_path : null
  if (assetPath && !assetPath.startsWith(`${user.id}/${params.projectId}/`)) {
    return NextResponse.json({ error: 'Asset path is outside this project.' }, { status: 400 })
  }
  const assetSize = Number(body.asset_size_bytes ?? 0)
  if (!Number.isSafeInteger(assetSize) || assetSize < 0 || assetSize > 524288000) {
    return NextResponse.json({ error: 'Video asset size must not exceed 500 MB.' }, { status: 400 })
  }
  const contentType = typeof body.content_type === 'string' && ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'].includes(body.content_type)
    ? body.content_type
    : 'video/mp4'

  const { data, error } = await supabase.from('scenes').insert({
    user_id: user.id,
    project_id: params.projectId,
    name: body.name.trim(),
    asset_path: assetPath,
    asset_size_bytes: assetSize,
    content_type: contentType,
    duration_seconds: duration,
    sort_order: sortOrder,
  }).select('id, project_id, name, asset_path, audio_path, asset_size_bytes, content_type, duration_seconds, sort_order, script_text, analysis, created_at, updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scene: data }, { status: 201 })
}