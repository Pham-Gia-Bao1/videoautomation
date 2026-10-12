import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

function unavailable() {
  return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
}

export async function GET() {
  if (!isSupabaseConfigured) return unavailable()
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status, aspect_ratio, created_at, updated_at, scenes(count)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projects: data })
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return unavailable()
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: { name?: unknown; aspect_ratio?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 100) {
    return NextResponse.json({ error: 'Project name must be between 1 and 100 characters.' }, { status: 400 })
  }
  const allowedRatios = ['9:16', '16:9', '1:1']
  const aspectRatio = typeof body.aspect_ratio === 'string' && allowedRatios.includes(body.aspect_ratio)
    ? body.aspect_ratio
    : '9:16'

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, aspect_ratio: aspectRatio })
    .select('id, name, status, aspect_ratio, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data }, { status: 201 })
}