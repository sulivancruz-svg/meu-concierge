export const PLATFORM_AGENCY_CONTEXT_ID_COOKIE = 'platform_agency_context_id';
export const PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE = 'platform_agency_context_slug';

export const PLATFORM_AGENCY_CONTEXT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};
