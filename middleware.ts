import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

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

  // Si no hay autenticación
  if (!user || !authToken) {
    // Las rutas de API NUNCA se redirigen. Un fetch() sigue el redirect solo,
    // termina pidiéndole el HTML a /login y recibe un 200 => el navegador cree
    // que se guardó bien cuando en realidad nunca se escribió nada en la base.
    // (Ese era el bug de los cierres que decían "guardado" y no aparecían.)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Tu sesión expiró. Volvé a iniciar sesión.', code: 'SESION_EXPIRADA' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Sesión válida: renovar las cookies en cada request (expiración deslizante)
  // para que la sesión no se muera a media jornada con el formulario ya lleno.
  const response = NextResponse.next();
  try {
    const opts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: SESSION_MAX_AGE,
      path: '/'
    };
    response.cookies.set('user', user, opts);
    response.cookies.set('authToken', authToken, opts);
  } catch (err) {
    // Si por algo no se pueden re-escribir las cookies, dejar pasar el request
    // igual: la sesión sigue siendo válida hasta su vencimiento original.
    console.error('No se pudo renovar la sesión:', err);
  }

  return response;
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
