import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  PLATFORM_AGENCY_CONTEXT_ID_COOKIE,
  PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE,
} from '@/lib/platform-context';

const PLATFORM_OWNER_AGENCY_SLUG = (process.env.PLATFORM_OWNER_AGENCY_SLUG ?? 'sulivan-cruz').trim().toLowerCase();

function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
}

async function getAgencySlugForUser(
  supabase: ReturnType<typeof createMiddlewareClient>,
  authUserId: string,
  request: NextRequest,
  response: NextResponse,
) {
  if (!supabase) {
    return null;
  }

  const { data: agencyUser } = await supabase
    .from('agency_users')
    .select('agencyId, role')
    .eq('authUserId', authUserId)
    .eq('status', 'ACTIVE')
    .is('deletedAt', null)
    .limit(1)
    .maybeSingle();

  if (!agencyUser?.agencyId) {
    return null;
  }

  const { data: baseAgency } = await supabase
    .from('agencies')
    .select('id, slug')
    .eq('id', agencyUser.agencyId)
    .limit(1)
    .maybeSingle();

  if (!baseAgency?.slug) {
    return null;
  }

  const contextAgencyId = request.cookies.get(PLATFORM_AGENCY_CONTEXT_ID_COOKIE)?.value ?? '';
  const contextAgencySlug = request.cookies.get(PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE)?.value ?? '';

  if (agencyUser.role === 'OWNER' && baseAgency.slug.toLowerCase() === PLATFORM_OWNER_AGENCY_SLUG && contextAgencyId) {
    const { data: contextAgency } = await supabase
      .from('agencies')
      .select('id, slug')
      .eq('id', contextAgencyId)
      .limit(1)
      .maybeSingle();

    if (contextAgency?.id && contextAgency.slug) {
      if (contextAgencySlug !== contextAgency.slug) {
        response.cookies.set(PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE, contextAgency.slug, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        });
      }

      return contextAgency.slug;
    }

    response.cookies.delete(PLATFORM_AGENCY_CONTEXT_ID_COOKIE);
    response.cookies.delete(PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE);
  }

  if (contextAgencyId && !(agencyUser.role === 'OWNER' && baseAgency.slug.toLowerCase() === PLATFORM_OWNER_AGENCY_SLUG)) {
    response.cookies.delete(PLATFORM_AGENCY_CONTEXT_ID_COOKIE);
    response.cookies.delete(PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE);
  }

  return baseAgency.slug;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createMiddlewareClient(request, response);
  const pathname = request.nextUrl.pathname;
  const sluggedDashboardMatch = pathname.match(/^\/([^/]+)\/dashboard(\/.*)?$/);
  const slugFromPath = sluggedDashboardMatch?.[1] ?? null;
  const dashboardSuffix = sluggedDashboardMatch?.[2] ?? '';
  const isDashboard = pathname.startsWith('/dashboard') || Boolean(sluggedDashboardMatch);
  const isAdminApi = pathname.startsWith('/api/admin');
  const isLoginPage = pathname === '/login';

  if (!supabase) {
    if (isDashboard || isAdminApi) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      return NextResponse.redirect(new URL('/login', request.url));
    }

    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if ((isDashboard || isAdminApi) && !user) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  const agencySlug = user ? await getAgencySlugForUser(supabase, user.id, request, response) : null;

  if (pathname.startsWith('/dashboard') && user && agencySlug) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = `/${agencySlug}${pathname}`;
    return NextResponse.redirect(nextUrl);
  }

  if (sluggedDashboardMatch) {
    if (!agencySlug) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (slugFromPath !== agencySlug) {
      const nextUrl = request.nextUrl.clone();
      nextUrl.pathname = `/${agencySlug}/dashboard${dashboardSuffix}`;
      return NextResponse.redirect(nextUrl);
    }

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/dashboard${dashboardSuffix}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  if (isLoginPage && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/:slug/dashboard/:path*', '/api/admin/:path*', '/login', '/register'],
};
