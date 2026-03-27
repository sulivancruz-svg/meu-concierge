import { NextRequest, NextResponse } from 'next/server';
import {
  PASSENGER_PORTAL_COOKIE,
  createPassengerPortalSessionToken,
  verifyPassengerPortalToken,
} from '@/lib/portal-access';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const payload = token ? verifyPassengerPortalToken(token) : null;

  if (!payload) {
    return NextResponse.redirect(new URL('/portal?error=invalid', request.url));
  }

  const response = NextResponse.redirect(new URL('/portal', request.url));
  response.cookies.set(PASSENGER_PORTAL_COOKIE, createPassengerPortalSessionToken({
    tripId: payload.tripId,
    passengerId: payload.passengerId,
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/portal',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
