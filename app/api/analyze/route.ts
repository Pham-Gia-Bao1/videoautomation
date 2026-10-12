import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI analysis is not configured. Add GEMINI_API_KEY on the server.' }, { status: 503 })
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: { sceneId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
  }
  if (typeof body.sceneId !== 'string') return NextResponse.json({ error: 'A sceneId is required.' }, { status: 400 })

  const { data: scene, error: sceneError } = await supabase.from('scenes')
    .select('id, project_id, name, asset_path, asset_size_bytes, content_type').eq('id', body.sceneId).eq('user_id', user.id).maybeSingle()
  if (sceneError) return NextResponse.json({ error: sceneError.message }, { status: 500 })
  if (!scene) return NextResponse.json({ error: 'Scene not found.' }, { status: 404 })
  if (!scene.asset_path) return NextResponse.json({ error: 'Upload a source video before analyzing this scene.' }, { status: 400 })
  if (scene.asset_size_bytes > 20 * 1024 * 1024) return NextResponse.json({ error: 'This clip exceeds the 20 MB inline analysis limit. Use a smaller clip.' }, { status: 413 })

  const { data: signed, error: signedError } = await supabase.storage.from('video-assets')
    .createSignedUrl(scene.asset_path, 60)
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 500 })
  const frameResponse = await fetch(signed.signedUrl, { signal: AbortSignal.timeout(20_000) })
  if (!frameResponse.ok) return NextResponse.json({ error: 'Could not read the uploaded clip.' }, { status: 502 })
  const frame = Buffer.from(await frameResponse.arrayBuffer())
  if (frame.byteLength > 20 * 1024 * 1024) return NextResponse.json({ error: 'Clip exceeds the 20 MB inline analysis limit.' }, { status: 413 })
  const videoPart = { inline_data: { mime_type: scene.content_type, data: frame.toString('base64') } }

  const prompt = `Analyze this short-form video clip named "${scene.name}". Return JSON only with keys: summary (one sentence), objects (array of short labels), action (one sentence), mood (short phrase), and script (a natural spoken line under 30 words).`
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, videoPart] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.35 },
    }),
  }).catch(() => null)
  if (!response) return NextResponse.json({ error: 'Analysis provider timed out. Try again.' }, { status: 504 })
  const providerBody = await response.json().catch(() => ({}))
  if (!response.ok) return NextResponse.json({ error: providerBody.error?.message || 'Analysis provider rejected the request.' }, { status: 502 })

  const text = providerBody.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('')
  let analysis: Record<string, unknown>
  try {
    analysis = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Analysis provider returned an invalid response.' }, { status: 502 })
  }
  const script = typeof analysis.script === 'string' ? analysis.script.slice(0, 5000) : ''
  const { error: updateError } = await supabase.from('scenes').update({ analysis, script_text: script })
    .eq('id', scene.id).eq('user_id', user.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ sceneId: scene.id, analysis, script })
}
