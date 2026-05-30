import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('user');
    cookieStore.delete('authToken');

    return Response.json({ success: true });
  } catch (err) {
    console.error('Error logout:', err);
    return Response.json({ error: 'Error al cerrar sesión' }, { status: 500 });
  }
}
