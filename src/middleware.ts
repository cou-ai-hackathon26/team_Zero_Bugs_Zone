import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, COOKIE_NAME } from './lib/session';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // 1. Run next-intl middleware first to resolve locale redirects (e.g. / -> /bn)
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

  // Protected paths requiring active session
  const isProtectedPath =
    subPath === 'dashboard' ||
    subPath.startsWith('dashboard/') ||
    subPath === 'cases' ||
    subPath.startsWith('cases/') ||
    subPath === 'library' ||
    subPath === 'ask' ||
    subPath === 'settings' ||
    subPath.startsWith('settings/');

  // 2. Unauthenticated check for protected routes
  if (isProtectedPath && !session) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((subPath === 'cases' || subPath.startsWith('cases/')) && session?.role !== 'doctor') {
    return NextResponse.redirect(new URL(`/${locale}/library`, request.url));
  }

  // 3. Authenticated user visiting /login redirects to dashboard
  if (subPath === 'login' && session) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return intlResponse;
}

export const config = {
  // Match only internationalized pathnames, skipping api, _next, static assets
  matcher: ['/', '/(bn|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
