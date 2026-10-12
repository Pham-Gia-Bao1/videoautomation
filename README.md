# ClipForge

ClipForge is a short-form video editing workspace built with Next.js 14 App Router, TypeScript, Ant Design 5, Zustand, and Supabase.

## Run locally

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Create an account from `/login` after filling the environment variables below.

## Supabase setup

1. Create a Supabase project and copy its Project URL and publishable key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. In Supabase SQL Editor, run [`supabase/migrations/202610120001_clipforge.sql`](supabase/migrations/202610120001_clipforge.sql). It creates projects, scenes, render jobs, owner-scoped RLS policies, and a private `video-assets` bucket.
3. In Supabase Auth settings, enable email/password and set the local redirect URL to `http://localhost:3000/auth/callback` (add the production callback URL when deploying).
4. Restart Next.js after changing `.env.local`.

The application uses the publishable key with authenticated user sessions and database RLS. Never put a secret/service-role key in a `NEXT_PUBLIC_*` variable. The server APIs deliberately use the signed-in user's session rather than bypassing RLS with a privileged key. Supabase SSR manages session verification/refresh, so the JWKS URL does not need to be configured separately.

## Provider setup

- `GEMINI_API_KEY`: enables authenticated per-scene analysis. Inline analysis currently accepts source clips up to 20 MB.
- `ELEVENLABS_API_KEY`: enables real text-to-speech generation. `ELEVENLABS_VOICE_ID` optionally overrides the default voice.
- `RENDER_WORKER_URL` and `RENDER_WORKER_TOKEN`: connect an FFmpeg worker. The worker accepts `POST /jobs` with `{ callback_job_id, project, scenes }` and returns `{ job_id }`. It exposes `GET /jobs/{job_id}` returning `{ status, progress, output_url, error }`. Scene inputs have short-lived signed `video_url` and optional `audio_url` values. Return an HTTPS output URL only after the export is available.

Provider keys are checked only on the server. Missing configuration returns a clear error; the UI does not simulate successful analysis, voice generation, or rendering.

## Application routes

- `/login`: email/password sign-in and account creation.
- `/projects`: authenticated project search, create, rename, open, and delete.
- `/upload`: multi-file upload to private Supabase Storage and scene management.
- `/arrange`, `/analyze`, `/script`, `/voice`, `/captions`, `/render`, `/export`: editor workflow.
- `/settings`: provider-key guidance and app preferences.

API routes under `/api/projects`, `/api/scenes`, `/api/analyze`, `/api/voice`, and `/api/render` validate the signed-in user and scope database operations to that user's rows. The render API is an adapter; FFmpeg must run in the configured worker, not in a Next.js request.

## Validation

```bash
npx tsc --noEmit
npm run build
```
