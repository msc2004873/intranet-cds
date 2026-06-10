import Script from 'next/script';
import './globals.css';

export const metadata = {
  title: 'App Corral del Sol',
  description: 'Sistema de cierre de caja veterinaria',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Corral del Sol',
  },
  themeColor: '#2a78a5',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
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
