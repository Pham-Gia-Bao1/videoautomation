import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Voice generation is not configured. Add ELEVENLABS_API_KEY on the server.' }, { status: 503 })
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: { sceneId?: unknown; text?: unknown; voiceId?: unknown; stability?: unknown; similarity?: unknown; speed?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
  }
  if (typeof body.sceneId !== 'string' || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 5000) {
    return NextResponse.json({ error: 'A sceneId and script under 5,000 characters are required.' }, { status: 400 })
  }
  const voiceId = typeof body.voiceId === 'string' && /^[\w-]{10,64}$/.test(body.voiceId)
    ? body.voiceId
    : process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID
  const numberInRange = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
  }

  const { data: scene, error: sceneError } = await supabase.from('scenes')
    .select('id, project_id, name, audio_path').eq('id', body.sceneId).eq('user_id', user.id).maybeSingle()
  if (sceneError) return NextResponse.json({ error: sceneError.message }, { status: 500 })
  if (!scene) return NextResponse.json({ error: 'Scene not found.' }, { status: 404 })

  const providerResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      text: body.text.trim(),
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: numberInRange(body.stability, 0.5, 0, 1),
        similarity_boost: numberInRange(body.similarity, 0.75, 0, 1),
        speed: numberInRange(body.speed, 1, 0.7, 1.2),
      },
    }),
  }).catch(() => null)
  if (!providerResponse) return NextResponse.json({ error: 'Voice provider timed out. Try again.' }, { status: 504 })
  if (!providerResponse.ok) {
    const detail = await providerResponse.json().catch(() => ({}))
    return NextResponse.json({ error: detail.detail?.message || 'Voice provider rejected the request.' }, { status: 502 })
  }

  const audio = Buffer.from(await providerResponse.arrayBuffer())
  if (!audio.length || audio.length > 25 * 1024 * 1024) return NextResponse.json({ error: 'Generated audio has an invalid size.' }, { status: 502 })
  const audioPath = `${user.id}/${scene.project_id}/audio/${scene.id}-${Date.now()}.mp3`
  const { error: storageError } = await supabase.storage.from('video-assets').upload(audioPath, audio, {
    contentType: 'audio/mpeg', upsert: true,
  })
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })

  const { error: updateError } = await supabase.from('scenes')
    .update({ audio_path: audioPath, script_text: body.text.trim() })
    .eq('id', scene.id).eq('user_id', user.id)
  if (updateError) {
    await supabase.storage.from('video-assets').remove([audioPath])
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }
  if (scene.audio_path && scene.audio_path !== audioPath) {
    await supabase.storage.from('video-assets').remove([scene.audio_path])
  }
  const { data: signed, error: signedError } = await supabase.storage.from('video-assets').createSignedUrl(audioPath, 300)
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 500 })
  return NextResponse.json({ sceneId: scene.id, audioPath, audioUrl: signed.signedUrl })
}