# Supabase Migrations

DB schema versionado en Git.

## Estructura

```
supabase/
  migrations/
    20260426234633_create_respuestas_cajeras.sql
  config.toml
```

## Setup (primera vez)

```bash
npx supabase login
npx supabase link --project-ref ccvhtcqeknbexmywzhiv
npx supabase push
```

## Usar después

**Crear nueva migración:**
```bash
npx supabase migration new <nombre>
```

**Aplicar migraciones a Supabase:**
```bash
npm run db:push
```

**Testear conexión:**
```bash
npm run db:test
```

## Ejemplo

```bash
# 1. Crear migración
npx supabase migration new add_status_column

# 2. Editar supabase/migrations/TIMESTAMP_add_status_column.sql
# ALTER TABLE respuestas_cajeras ADD COLUMN status TEXT;

# 3. Aplicar
npm run db:push
```

## Notas

- Cada migración es inmutable (no editarla después de aplicada)
- Si hay error, crea una nueva migración que lo arregle
- Cambios se syncan automáticamente en Vercel
