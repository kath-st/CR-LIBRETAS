# Base de datos Supabase

## Contenido

- `migrations/20260723000100_phase_1_foundation.sql`: estructura y RLS.
- `migrations/20260723000200_phase_2_auth_admin.sql`: aprobación, contraseña
  temporal y validación de asignaciones.
- `migrations/20260723000300_phase_3_academic_flow.sql`: alumnos, matrículas,
  malla, notas, recomendaciones, integridad y RLS académico.
- `migrations/20260723000400_phase_4_report_cards.sql`: historial privado,
  instantáneas y almacenamiento inmutable de boletas.
- `migrations/20260724000100_phase_5_import_backups.sql`: importación por lote,
  respaldos JSON, integridad SHA-256 y restauración transaccional.
- `migrations/20260724000200_phase_6_withdrawal_enforcement.sql`: bloqueo en
  PostgreSQL de notas y recomendaciones posteriores al retiro.
- `migrations/20260724000300_phase_6_restore_variable_resolution.sql`:
  corrección verificada de la restauración transaccional de respaldos.
- `seed.sql`: configuración institucional inicial.
- `tests/database/001_rls_group_isolation.test.sql`: prueba pgTAP de aislamiento.
- `tests/database/003_phase_3_academic_flow.test.sql`: aislamiento e integridad
  del flujo académico.
- `tests/database/004_phase_4_report_cards.test.sql`: privacidad e inmutabilidad
  de las boletas.
- `tests/database/005_phase_5_import_backups.test.sql`: atomicidad, integridad y
  respaldo automático previo a una restauración.
- `tests/database/006_phase_6_final_validation.test.sql`: RLS integral, retiro,
  conservación histórica y reactivación.
- `config.toml`: configuración local de Supabase CLI.

## Ejecución local

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
npx supabase link --project-ref PROJECT_REF
npx supabase migration list
npm run db:push
npx supabase migration list
```

La configuración del entorno, Auth y la primera administradora se explica en
el [README principal](../README.md).

La clave privada no es necesaria para migrar y nunca debe llegar al navegador.
La aplicación prioriza `SUPABASE_SECRET_KEY` y conserva compatibilidad temporal
con `SUPABASE_SERVICE_ROLE_KEY`.
