import './globals.css';

export const metadata = {
  title: 'Corral del Sol - Cierre de Caja',
  description: 'Sistema de cierre de caja veterinaria',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
        <script src="/supabase-bridge.js" defer></script>
      </body>
    </html>
  );
}
