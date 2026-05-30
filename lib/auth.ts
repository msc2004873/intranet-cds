import { cookies } from 'next/headers';

export async function validateAuth() {
  const cookieStore = await cookies();
  const user = cookieStore.get('user')?.value;
  const authToken = cookieStore.get('authToken')?.value;

  if (!user || !authToken) {
    throw new Error('Unauthorized');
  }

  try {
    return JSON.parse(user);
  } catch {
    throw new Error('Invalid user data');
  }
}

export async function validateAuthFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies: Record<string, string> = {};

  cookieHeader.split(';').forEach(cookie => {
    const [key, value] = cookie.split('=').map(c => c.trim());
    if (key && value) cookies[key] = decodeURIComponent(value);
  });

  const user = cookies['user'];
  const authToken = cookies['authToken'];

  if (!user || !authToken) {
    throw new Error('Unauthorized');
  }

  try {
    return JSON.parse(user);
  } catch {
    throw new Error('Invalid user data');
  }
}
