import type { AgencyUserRole } from '@prisma/client';
import { cookies } from 'next/headers';
import {
  PLATFORM_AGENCY_CONTEXT_ID_COOKIE,
} from './platform-context';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from './supabase/server';

export type AdminRole = AgencyUserRole;
export const ADMIN_ROLES: AdminRole[] = ['OWNER', 'ADMIN', 'AGENT'];

export interface AdminSession {
  user: {
    id: string;
    authUserId: string;
    agencyId: string;
    agencySlug: string;
    agencyName: string;
    baseAgencyId: string;
    baseAgencySlug: string;
    baseAgencyName: string;
    role: AdminRole;
    isPlatformOwner: boolean;
    name: string;
    email: string;
  };
}

interface AgencyUserAccessRow {
  id: string;
  agencyId: string;
  role: AgencyUserRole;
  name: string;
  email: string;
}

const PLATFORM_OWNER_AGENCY_SLUG = (process.env.PLATFORM_OWNER_AGENCY_SLUG ?? 'sulivan-cruz').trim().toLowerCase();

interface AgencyIdentityRow {
  id: string;
  slug: string;
  name: string;
}

export async function findAgencyUserByAuthUserId(authUserId: string): Promise<AgencyUserAccessRow | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('agency_users')
    .select('id, agencyId, role, name, email')
    .eq('authUserId', authUserId)
    .eq('status', 'ACTIVE')
    .is('deletedAt', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function touchAgencyUserLastLogin(userId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from('agency_users')
    .update({ lastLoginAt: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

async function findAgencyById(agencyId: string): Promise<AgencyIdentityRow | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('agencies')
    .select('id, slug, name')
    .eq('id', agencyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getSession(): Promise<AdminSession | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const agencyUser = await findAgencyUserByAuthUserId(user.id);

  if (!agencyUser) {
    return null;
  }

  const baseAgency = await findAgencyById(agencyUser.agencyId);
  if (!baseAgency) {
    return null;
  }

  let effectiveAgency = baseAgency;
  const isPlatformOwner = agencyUser.role === 'OWNER' && baseAgency.slug.toLowerCase() === PLATFORM_OWNER_AGENCY_SLUG;

  if (isPlatformOwner) {
    const cookieStore = await cookies();
    const contextAgencyId = cookieStore.get(PLATFORM_AGENCY_CONTEXT_ID_COOKIE)?.value ?? '';

    if (contextAgencyId) {
      const contextAgency = await findAgencyById(contextAgencyId);

      if (contextAgency) {
        effectiveAgency = contextAgency;
      }
    }
  }

  return {
    user: {
      id: agencyUser.id,
      authUserId: user.id,
      agencyId: effectiveAgency.id,
      agencySlug: effectiveAgency.slug,
      agencyName: effectiveAgency.name,
      baseAgencyId: baseAgency.id,
      baseAgencySlug: baseAgency.slug,
      baseAgencyName: baseAgency.name,
      role: agencyUser.role as AdminRole,
      isPlatformOwner,
      name: agencyUser.name,
      email: agencyUser.email,
    },
  };
}

export async function requireAdmin(allowedRoles: AdminRole[] = ADMIN_ROLES) {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  if (!allowedRoles.includes(session.user.role)) {
    throw new Error('FORBIDDEN');
  }

  return session;
}

export async function requirePlatformOwner() {
  const session = await requireAdmin(['OWNER']);

  if (!session.user.isPlatformOwner) {
    throw new Error('FORBIDDEN');
  }

  return session;
}
