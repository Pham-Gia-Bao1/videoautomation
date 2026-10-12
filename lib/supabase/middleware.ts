import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseConfig, isSupabaseConfigured } from './config'

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next({ request })

  const response = NextResponse.next({ request })
  const { url, key } = getSupabaseConfig()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const isProtectedPage = !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth/') &&
    !request.nextUrl.pathname.startsWith('/api/')

  if (!user && isProtectedPage) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  return response
}