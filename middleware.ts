import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rutas públicas (sin autenticación requerida)
  const publicRoutes = ['/login', '/_next', '/api/auth'];

  // Si es ruta pública, permitir
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Para cualquier otra ruta, verificar autenticación
  const user = request.cookies.get('user')?.value;
  const authToken = request.cookies.get('authToken')?.value;

  // Si no hay autenticación, redirigir a login
  if (!user || !authToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (static assets)
     * - .png, .jpg, .gif, .svg (image files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.gif|.*\\.svg).*)',
  ],
};
