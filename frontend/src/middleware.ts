import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is public
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check for auth token in cookies or headers
  const token = request.cookies.get('access_token')?.value;
  
  // For API routes, let the backend handle auth
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    // Check localStorage via a client-side check won't work in middleware
    // We'll let the client handle this, but redirect to login as default
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
