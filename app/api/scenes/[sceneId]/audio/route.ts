import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: { sceneId: string } }) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: scene, error } = await supabase.from('scenes')
    .select('audio_path').eq('id', params.sceneId).eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!scene?.audio_path) return NextResponse.json({ error: 'This scene has no generated audio.' }, { status: 404 })
  const { data: signed, error: signedError } = await supabase.storage.from('video-assets').createSignedUrl(scene.audio_path, 300)
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 500 })
  return NextResponse.json({ audioUrl: signed.signedUrl })
}