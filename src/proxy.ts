import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, COOKIE_NAME } from './lib/session';

const intlMiddleware = createMiddleware(routing);

/**
 * Returns the primary landing panel path for each role.
 */
export function getRoleDefaultPath(role: string): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/admin';
    case 'doctor':
      return '/dashboard';
    case 'student':
      return '/ask';
    case 'researcher':
    case 'medicine_controller':
      return '/library';
    case 'patient':
      return '/prescriptions';
    default:
      return '/dashboard';
  }
}

/**
 * Evaluates whether a role is authorized to access a given subPath.
 *
 * RBAC Rules:
 * - super_admin: Full access to all panels (/admin, /dashboard, /patients, /prescriptions, /cases, /library, /ask, /settings).
 * - doctor: Clinical decision support (/dashboard, /patients, /prescriptions, /cases, /library, /ask, /settings).
 *           Forbidden from /admin control plane.
 * - student: Trainee learning (/ask, /library, /settings).
 *            Strictly forbidden from patient data (/patients, /prescriptions, /cases), /dashboard, and /admin.
 * - researcher: Guideline & literature research (/library, /ask, /settings).
 *               Strictly forbidden from patient data (/patients, /prescriptions, /cases), /dashboard, and /admin.
 * - medicine_controller: Guideline & formulary inspection (/library, /ask, /settings).
 *                        Strictly forbidden from patient data (/patients, /prescriptions, /cases), /dashboard, and /admin.
 * - patient: Personal portal (/prescriptions, /settings).
 *            Forbidden from other clinical workspaces, library, ask, and admin.
 */
export function isRouteAllowedForRole(subPath: string, role: string): boolean {
  const rootSegment = subPath.split('/')[0];

  // 1. Super Admin has unrestricted operational access across all features
  if (role === 'super_admin' || role === 'admin') {
    return true;
  }

  // 2. Doctor: Clinical workspace
  if (role === 'doctor') {
    // Only Super Admin can enter the /admin control plane
    if (rootSegment === 'admin') return false;
    return true;
  }

  // 3. Student (Medical Trainee): Learning and guideline exploration only
  // Zero patient data exposure
  if (role === 'student') {
    return rootSegment === 'ask' || rootSegment === 'library' || rootSegment === 'settings';
  }

  // 4. Researcher & Medicine Controller: Medical library & guideline search
  // Zero patient data exposure
  if (role === 'researcher' || role === 'medicine_controller') {
    return rootSegment === 'library' || rootSegment === 'ask' || rootSegment === 'settings';
  }

  // 5. Patient: Personal prescriptions and settings only
  if (role === 'patient') {
    return rootSegment === 'prescriptions' || rootSegment === 'settings';
  }

  return false;
}

/**
 * Helper to create a redirect response while preserving cookies set by next-intl.
 */
function createRedirect(url: URL | string, intlResponse?: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  if (intlResponse) {
    intlResponse.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c);
    });
  }
  return redirectResponse;
}

export default async function proxy(request: NextRequest) {
  // 1. Run next-intl middleware first to resolve locale redirects (e.g. / -> /bn or cookie detection)
  const intlResponse = intlMiddleware(request);

  // If next-intl generated a redirect, return immediately
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  const { pathname } = request.nextUrl;

  // Extract locale and subpath from pathname, e.g. /bn/cases/new -> locale: 'bn', subPath: 'cases/new'
  const segments = pathname.split('/').filter(Boolean);
  const hasLocale = segments.length > 0 && (segments[0] === 'bn' || segments[0] === 'en');
  const locale = hasLocale ? segments[0] : 'bn';
  const subPath = hasLocale ? segments.slice(1).join('/') : segments.join('/');

  // Session verification
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // 2. Check login page access for already authenticated users
  if (subPath === 'login') {
    if (session) {
      // Redirect already logged in users directly to their designated role panel
      const targetUrl = new URL(`/${locale}${getRoleDefaultPath(session.role)}`, request.url);
      return createRedirect(targetUrl, intlResponse);
    }
    return intlResponse;
  }

  // Protected paths requiring active session
  const rootSegment = subPath.split('/')[0];
  const protectedSegments = [
    'dashboard',
    'patients',
    'prescriptions',
    'cases',
    'library',
    'ask',
    'settings',
    'admin',
  ];
  const isProtectedPath = protectedSegments.includes(rootSegment);

  // 3. Unauthenticated check for protected routes
  if (isProtectedPath && !session) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return createRedirect(loginUrl, intlResponse);
  }

  // 4. Authenticated RBAC checks: redirect unauthorized roles to their primary panel
  if (isProtectedPath && session) {
    const isAllowed = isRouteAllowedForRole(subPath, session.role);
    if (!isAllowed) {
      const fallbackUrl = new URL(`/${locale}${getRoleDefaultPath(session.role)}`, request.url);
      return createRedirect(fallbackUrl, intlResponse);
    }
  }

  return intlResponse;
}

export const config = {
  // Match only internationalized pathnames, skipping api, _next, static assets
  matcher: ['/', '/(bn|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
