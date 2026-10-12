import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

const SELECT_FIELDS = 'id, project_id, status, progress, output_url, error, created_at, updated_at'

function config() {
  const baseUrl = process.env.RENDER_WORKER_URL?.replace(/\/$/, '')
  const token = process.env.RENDER_WORKER_TOKEN
  return baseUrl && token ? { baseUrl, token } : null
}

export async function POST(request: Request) {
  const worker = config()
  if (!worker) return NextResponse.json({ error: 'Video rendering is not configured. Set RENDER_WORKER_URL and RENDER_WORKER_TOKEN for an FFmpeg worker.' }, { status: 503 })
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  let body: { projectId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
  }
  if (typeof body.projectId !== 'string') return NextResponse.json({ error: 'A projectId is required.' }, { status: 400 })

  const [{ data: project, error: projectError }, { data: scenes, error: scenesError }] = await Promise.all([
    supabase.from('projects').select('id, name, aspect_ratio').eq('id', body.projectId).eq('user_id', user.id).maybeSingle(),
    supabase.from('scenes').select('id, name, asset_path, audio_path, duration_seconds, sort_order, script_text')
      .eq('project_id', body.projectId).eq('user_id', user.id).order('sort_order'),
  ])
  if (projectError || scenesError) return NextResponse.json({ error: projectError?.message || scenesError?.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  if (!scenes?.length || scenes.some((scene) => !scene.asset_path)) return NextResponse.json({ error: 'Every scene must have an uploaded video before rendering.' }, { status: 400 })

  const inputs = await Promise.all(scenes.map(async (scene) => {
    const video = await supabase.storage.from('video-assets').createSignedUrl(scene.asset_path!, 3600)
    if (video.error) throw new Error(video.error.message)
    const audio = scene.audio_path
      ? await supabase.storage.from('video-assets').createSignedUrl(scene.audio_path, 3600)
      : null
    if (audio?.error) throw new Error(audio.error.message)
    return {
      id: scene.id,
      name: scene.name,
      video_url: video.data.signedUrl,
      audio_url: audio?.data.signedUrl || null,
      duration_seconds: Number(scene.duration_seconds),
      script_text: scene.script_text,
    }
  })).catch((error) => error)
  if (inputs instanceof Error) return NextResponse.json({ error: inputs.message }, { status: 500 })

  const { data: job, error: insertError } = await supabase.from('render_jobs').insert({
    user_id: user.id,
    project_id: project.id,
    status: 'queued',
    progress: 0,
  }).select(SELECT_FIELDS).single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const workerResponse = await fetch(`${worker.baseUrl}/jobs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${worker.token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      callback_job_id: job.id,
      project: { id: project.id, name: project.name, aspect_ratio: project.aspect_ratio },
      scenes: inputs,
    }),
  }).catch(() => null)
  if (!workerResponse) {
    await supabase.from('render_jobs').update({ status: 'failed', error: 'Render worker timed out.' }).eq('id', job.id).eq('user_id', user.id)
    return NextResponse.json({ error: 'Render worker timed out while accepting the job.' }, { status: 504 })
  }
  const workerBody = await workerResponse.json().catch(() => ({}))
  if (!workerResponse.ok || typeof workerBody.job_id !== 'string') {
    const detail = workerBody.error || 'Render worker did not return a job ID.'
    await supabase.from('render_jobs').update({ status: 'failed', error: String(detail).slice(0, 500) }).eq('id', job.id).eq('user_id', user.id)
    return NextResponse.json({ error: detail }, { status: 502 })
  }

  const { data: saved, error: saveError } = await supabase.from('render_jobs')
    .update({ worker_job_id: workerBody.job_id, status: 'processing' })
    .eq('id', job.id).eq('user_id', user.id).select(SELECT_FIELDS).single()
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 })
  return NextResponse.json({ job: saved }, { status: 202 })
}

export async function GET(request: Request) {
  const worker = config()
  if (!worker) return NextResponse.json({ error: 'Video rendering is not configured.' }, { status: 503 })
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  const jobId = new URL(request.url).searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'A jobId is required.' }, { status: 400 })

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: job, error } = await supabase.from('render_jobs').select(`${SELECT_FIELDS}, worker_job_id`)
    .eq('id', jobId).eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Render job not found.' }, { status: 404 })
  if (!job.worker_job_id || job.status === 'failed' || job.status === 'completed') return NextResponse.json({ job })

  const statusResponse = await fetch(`${worker.baseUrl}/jobs/${encodeURIComponent(job.worker_job_id)}`, {
    headers: { Authorization: `Bearer ${worker.token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  if (!statusResponse) return NextResponse.json({ error: 'Render worker status check timed out.' }, { status: 504 })
  const statusBody = await statusResponse.json().catch(() => ({}))
  if (!statusResponse.ok) return NextResponse.json({ error: statusBody.error || 'Could not read render job status.' }, { status: 502 })

  const status = ['queued', 'processing', 'completed', 'failed'].includes(statusBody.status) ? statusBody.status : job.status
  const progress = Number.isInteger(statusBody.progress) ? Math.min(100, Math.max(0, statusBody.progress)) : job.progress
  const outputUrl = typeof statusBody.output_url === 'string' && statusBody.output_url.startsWith('https://') ? statusBody.output_url : null
  const errorText = status === 'completed' && !outputUrl
    ? 'Render worker completed without returning a secure HTTPS output URL.'
    : typeof statusBody.error === 'string' ? statusBody.error.slice(0, 500) : null
  const { data: updated, error: updateError } = await supabase.from('render_jobs')
    .update({ status: status === 'completed' && !outputUrl ? 'failed' : status, progress, output_url: outputUrl, error: errorText })
    .eq('id', job.id).eq('user_id', user.id).select(SELECT_FIELDS).single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ job: updated })
}