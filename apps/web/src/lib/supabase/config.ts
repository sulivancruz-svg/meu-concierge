type SupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  projectRef: string;
  storageBucket: string;
  signedUrlTtl: number;
};

export function getSupabaseEnv(): SupabaseEnv {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    projectRef: process.env.SUPABASE_PROJECT_REF || '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'passenger-documents',
    signedUrlTtl: parseInt(process.env.SUPABASE_STORAGE_SIGNED_URL_TTL || '3600', 10),
  };
}

export function assertSupabaseEnv(keys: Array<keyof SupabaseEnv>) {
  const env = getSupabaseEnv();

  for (const key of keys) {
    const value = env[key];
    if (!value) {
      throw new Error(`Missing Supabase environment variable for ${key}`);
    }
  }

  return env;
}

export function getSupabaseSetupStatus() {
  const env = getSupabaseEnv();
  const checks = [
    { key: 'DATABASE_URL', configured: Boolean(process.env.DATABASE_URL) },
    { key: 'DIRECT_URL', configured: Boolean(process.env.DIRECT_URL) },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', configured: Boolean(env.url) },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', configured: Boolean(env.anonKey) },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', configured: Boolean(env.serviceRoleKey) },
    { key: 'SUPABASE_PROJECT_REF', configured: Boolean(env.projectRef) },
  ];

  return {
    ...env,
    configured: checks.every((item) => item.configured),
    checks,
  };
}
