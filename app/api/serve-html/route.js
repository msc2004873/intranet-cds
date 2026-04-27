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

    // Inyectar el script DENTRO del HTML (antes de </body>)
    html = html.replace(
      '</body>',
      '<script src="/supabase-bridge.js"><\/script>\n</body>'
    );

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
