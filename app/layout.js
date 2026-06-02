import Script from 'next/script';
import './globals.css';

export const metadata = {
  title: 'Corral del Sol - Cierre de Caja',
  description: 'Sistema de cierre de caja veterinaria',
  icons: {
    icon: '/logo.png.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Script src="/supabase-bridge.js" defer />
      </body>
    </html>
  );
}
