import { NextResponse } from 'next/server';
import { PASSENGER_PORTAL_COOKIE } from '@/lib/portal-access';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/portal?logged_out=1', request.url));
  response.cookies.set(PASSENGER_PORTAL_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/portal',
    maxAge: 0,
  });

  return response;
}
