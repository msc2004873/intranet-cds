import fs from 'fs';
import path from 'path';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get('file');

  // Solo permitir archivos específicos
  if (!file || !['cajera', 'revisora', 'preview'].includes(file)) {
    return new Response('Not Found', { status: 404 });
  }

  const htmlPath = path.join(process.cwd(), 'public', `${file}.html`);

  try {
    let html = fs.readFileSync(htmlPath, 'utf-8');

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response('Error loading file', { status: 500 });
  }
}
