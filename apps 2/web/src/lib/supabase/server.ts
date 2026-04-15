import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { assertSupabaseEnv } from './config';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const env = assertSupabaseEnv(['url', 'anonKey']);

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components can read cookies but may not persist writes.
        }
      },
    },
  });
}

export function createSupabaseRouteClient() {
  return createSupabaseServerClient();
}

export function createSupabaseRouteHandlerClient(request: NextRequest) {
  const env = assertSupabaseEnv(['url', 'anonKey']);
  const cookiesToSet: Array<{ name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }> = [];

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies) {
        nextCookies.forEach(({ name, value, options }) => {
          cookiesToSet.push({ name, value, options });
        });
      },
    },
  });

  function applyCookies(response: NextResponse) {
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  }

  return { supabase, applyCookies };
}

export function createSupabaseServiceRoleClient() {
  const env = assertSupabaseEnv(['url', 'serviceRoleKey']);

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
