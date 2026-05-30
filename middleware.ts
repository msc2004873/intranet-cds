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
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
