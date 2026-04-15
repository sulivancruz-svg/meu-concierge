import { NextRequest, NextResponse } from 'next/server';
import { findAgencyUserByAuthUserId, requirePlatformOwner } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  PLATFORM_AGENCY_CONTEXT_COOKIE_OPTIONS,
  PLATFORM_AGENCY_CONTEXT_ID_COOKIE,
  PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE,
} from '@/lib/platform-context';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePlatformOwner();
    const baseAgencyUser = await findAgencyUserByAuthUserId(session.user.authUserId);

    if (!baseAgencyUser) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const agency = await prisma.agency.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!agency) {
      return NextResponse.redirect(new URL('/dashboard/settings?agencySwitchError=not-found', request.url));
    }

    const response = NextResponse.redirect(new URL(`/${agency.slug}/dashboard`, request.url));

    if (agency.id === baseAgencyUser.agencyId) {
      response.cookies.delete(PLATFORM_AGENCY_CONTEXT_ID_COOKIE);
      response.cookies.delete(PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE);
    } else {
      response.cookies.set(PLATFORM_AGENCY_CONTEXT_ID_COOKIE, agency.id, PLATFORM_AGENCY_CONTEXT_COOKIE_OPTIONS);
      response.cookies.set(PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE, agency.slug, PLATFORM_AGENCY_CONTEXT_COOKIE_OPTIONS);
    }

    await createAuditLog({
      agencyId: baseAgencyUser.agencyId,
      userId: baseAgencyUser.id,
      action: 'platform.agency.context_switched',
      entityType: 'agency',
      entityId: agency.id,
      meta: {
        name: agency.name,
        slug: agency.slug,
      },
    });

    return response;
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.redirect(new URL('/dashboard/settings?agencySwitchError=failed', request.url));
  }
}
