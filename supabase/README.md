# Base Supabase — Fases 1 y 2

## Contenido

- `migrations/20260723000100_phase_1_foundation.sql`: estructura y RLS.
- `migrations/20260723000200_phase_2_auth_admin.sql`: aprobación, contraseña
  temporal y validación de asignaciones.
- `seed.sql`: configuración institucional inicial.
- `tests/database/001_rls_group_isolation.test.sql`: prueba pgTAP de aislamiento.
- `config.toml`: configuración local de Supabase CLI.

## Aplicación local

Requiere Docker Desktop:

```bash
npm run db:start
npm run db:reset
npm run db:test
```

## Aplicación al proyecto remoto

La URL y la clave pública no permiten ejecutar migraciones. Una persona con
acceso administrativo debe iniciar sesión y vincular el proyecto:

```bash
npx supabase login
npx supabase link --project-ref kozvkxafapxlflkfgowm
npm run db:push
```

La creación de la primera administradora y la configuración de la clave privada
se explican en `docs/fase-2-autenticacion-administracion.md`.

La clave privada no es necesaria para migrar y nunca debe llegar al navegador.
La aplicación prioriza `SUPABASE_SECRET_KEY` y conserva compatibilidad temporal
con `SUPABASE_SERVICE_ROLE_KEY`.
