import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

type Context = { params: { projectId: string } }

export async function GET(_request: Request, { params }: Context) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status, aspect_ratio, editor_state, created_at, updated_at')
    .eq('id', params.projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  return NextResponse.json({ project: data })
}

export async function PATCH(request: Request, { params }: Context) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: { name?: unknown; status?: unknown; aspect_ratio?: unknown; editor_state?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) {
      return NextResponse.json({ error: 'Project name must be between 1 and 100 characters.' }, { status: 400 })
    }
    updates.name = body.name.trim()
  }
  if (body.status !== undefined) {
    if (!['draft', 'processing', 'completed', 'archived'].includes(String(body.status))) {
      return NextResponse.json({ error: 'Invalid project status.' }, { status: 400 })
    }
    updates.status = body.status
  }
  if (body.aspect_ratio !== undefined) {
    if (!['9:16', '16:9', '1:1'].includes(String(body.aspect_ratio))) {
      return NextResponse.json({ error: 'Invalid aspect ratio.' }, { status: 400 })
    }
    updates.aspect_ratio = body.aspect_ratio
  }
  if (body.editor_state !== undefined) {
    if (!body.editor_state || typeof body.editor_state !== 'object' || Array.isArray(body.editor_state)) {
      return NextResponse.json({ error: 'Editor state must be a JSON object.' }, { status: 400 })
    }
    updates.editor_state = body.editor_state
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid updates provided.' }, { status: 400 })

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', params.projectId)
    .eq('user_id', user.id)
    .select('id, name, status, aspect_ratio, editor_state, updated_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  return NextResponse.json({ project: data })
}

export async function DELETE(_request: Request, { params }: Context) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: scenes, error: sceneError } = await supabase
    .from('scenes')
    .select('asset_path')
    .eq('project_id', params.projectId)
    .eq('user_id', user.id)
    .not('asset_path', 'is', null)
  if (sceneError) return NextResponse.json({ error: sceneError.message }, { status: 500 })

  const assetPaths = (scenes ?? []).map((scene) => scene.asset_path).filter((path): path is string => Boolean(path))
  if (assetPaths.length) {
    const { error: storageError } = await supabase.storage.from('video-assets').remove(assetPaths)
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('projects')
    .delete()
    .eq('id', params.projectId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}