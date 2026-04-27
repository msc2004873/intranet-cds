# Intranet Corral del Sol — Cierre de Caja

Sistema web de cierre de caja para clínica veterinaria, built with **Next.js + Supabase**.

Mantiene los HTML files originales (`Cajera.html`, `Revisora.html`, `preview.html`) y los conecta a Supabase mediante un puente JS.

## Setup

### 1. Credenciales Supabase

Asegúrate de tener `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://ccvhtcqeknbexmywzhiv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

### 2. Base de datos

Aplica las migraciones:
```bash
npx supabase link --project-ref ccvhtcqeknbexmywzhiv
npx supabase push
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Levantar servidor

```bash
npm run dev
```

Luego abre en el navegador:
- **Cajera**: http://localhost:3000/cajera
- **Revisora**: http://localhost:3000/revisora
- **Preview**: http://localhost:3000/preview.html

## Estructura

```
app/
  api/
    cierreCaja/route.js      — API para cajera
    revision/route.js         — API para revisora
  cajera/page.js             — Ruta que sirve Cajera.html
  revisora/page.js           — Ruta que sirve Revisora.html
  layout.js
  globals.css

public/
  cajera.html                — Formulario de cajera (original)
  revisora.html              — Formulario de revisora (original)
  preview.html               — Preview (original)
  supabase-bridge.js         — Puente google.script.run → Supabase

lib/
  supabase-server.js
  supabase-client.js

supabase/
  migrations/                — Migraciones de BD
  config.toml

_old/                        — Código legacy de Google Apps Script (archivado)
```

## Cómo funciona

1. **HTML files sin cambios**: Los archivos `.html` en `public/` son los originales
2. **Rutas Next.js**: Las rutas `/cajera` y `/revisora` sirven esos HTML files
3. **Puente Supabase**: `supabase-bridge.js` intercepta `google.script.run` y lo convierte en llamadas fetch() a las APIs
4. **APIs**: `/api/cierreCaja` y `/api/revision` guardan los datos en Supabase

## Comandos

```bash
npm run dev          # Levantar servidor (localhost:3000)
npm run build        # Build para producción
npm run start        # Iniciar servidor en prod
npm run db:test      # Testear conexión a Supabase
npm run db:push      # Aplicar migraciones a Supabase
```

## Deployar a Vercel

```bash
git add .
git commit -m "feat: integrate HTML forms with Supabase"
git push

vercel deploy
```

Agregar `.env` variables en Vercel settings.

## Features

✅ Formularios originales intactos (Cajera, Revisora)
✅ Integración Supabase sin cambiar el HTML
✅ APIs REST para guardar datos
✅ Migraciones versionadas en Git
✅ Responsive design
✅ Diseño visual original preservado

## TODO

- [ ] Upload de PDFs a Supabase Storage
- [ ] Upload de fotos a Supabase Storage
- [ ] Dashboard de resúmenes
- [ ] Autenticación con Google
- [ ] Reportes y analytics
