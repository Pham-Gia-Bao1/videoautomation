import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

type Context = { params: { sceneId: string } }

async function authenticatedClient() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

export async function PATCH(request: Request, { params }: Context) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const { supabase, user } = await authenticatedClient()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  let body: { name?: unknown; duration_seconds?: unknown; sort_order?: unknown; script_text?: unknown; analysis?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
  }
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 255) return NextResponse.json({ error: 'Invalid scene name.' }, { status: 400 })
    updates.name = body.name.trim()
  }
  if (body.duration_seconds !== undefined) {
    const duration = Number(body.duration_seconds)
    if (!Number.isFinite(duration) || duration < 0) return NextResponse.json({ error: 'Invalid scene duration.' }, { status: 400 })
    updates.duration_seconds = duration
  }
  if (body.sort_order !== undefined) {
    const order = Number(body.sort_order)
    if (!Number.isInteger(order) || order < 0) return NextResponse.json({ error: 'Invalid scene order.' }, { status: 400 })
    updates.sort_order = order
  }
  if (body.script_text !== undefined) {
    if (typeof body.script_text !== 'string' || body.script_text.length > 5000) return NextResponse.json({ error: 'Script must be under 5,000 characters.' }, { status: 400 })
    updates.script_text = body.script_text
  }
  if (body.analysis !== undefined) {
    if (body.analysis === null || typeof body.analysis !== 'object' || Array.isArray(body.analysis)) return NextResponse.json({ error: 'Analysis must be a JSON object.' }, { status: 400 })
    updates.analysis = body.analysis
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid updates provided.' }, { status: 400 })

  const { data, error } = await supabase.from('scenes').update(updates)
    .eq('id', params.sceneId).eq('user_id', user.id)
    .select('id, project_id, name, asset_path, audio_path, duration_seconds, sort_order, script_text, analysis, updated_at')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Scene not found.' }, { status: 404 })
  return NextResponse.json({ scene: data })
}

export async function DELETE(_request: Request, { params }: Context) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const { supabase, user } = await authenticatedClient()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: scene, error: findError } = await supabase.from('scenes')
    .select('id, asset_path').eq('id', params.sceneId).eq('user_id', user.id).maybeSingle()
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!scene) return NextResponse.json({ error: 'Scene not found.' }, { status: 404 })
  if (scene.asset_path) {
    const { error } = await supabase.storage.from('video-assets').remove([scene.asset_path])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { error } = await supabase.from('scenes').delete().eq('id', scene.id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}