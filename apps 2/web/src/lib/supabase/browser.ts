'use client';

import { createBrowserClient } from '@supabase/ssr';
import { assertSupabaseEnv } from './config';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const env = assertSupabaseEnv(['url', 'anonKey']);
  browserClient = createBrowserClient(env.url, env.anonKey);
  return browserClient;
}
