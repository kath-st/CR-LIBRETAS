# Estado de las Fases 0, 1 y 2

## Fase 0 — completada

- Reglas académicas confirmadas y documentadas.
- Casos de cálculo versionados.
- Pruebas para `NULL`, cero, precisión, redondeo y ranking denso.
- Boleta estática con datos ficticios y contenido amplio.
- Hoja comprobada en navegador con medidas CSS de `793.7 × 1122.5 px`,
  equivalentes a `210 × 297 mm`.
- Los 19 renglones académicos, el resumen y las imágenes quedaron dentro de la
  hoja A4.

## Fase 1 — completada

- Next.js App Router con TypeScript estricto.
- ESLint, alias `@/*`, CSS Modules y variables visuales.
- Login, registro y cuenta pendiente.
- Button, TextField, PasswordField, Card, Alert, Spinner y Modal.
- Clientes Supabase de navegador y servidor.
- Renovación de sesión mediante Proxy.
- Migración inicial para perfiles, institución y grupos académicos.
- Seed institucional.
- RLS para impedir acceso a grupos ajenos.
- Prueba pgTAP de aislamiento entre dos docentes.

## Fase 2 — código completado

- Registro y login reales mediante DNI.
- Email sintético oculto para Supabase Auth.
- Cuentas pendientes, activas e inactivas.
- Protección de páginas por sesión, estado y rol.
- Administración de docentes sin eliminación de historial.
- Contraseña temporal y cambio obligatorio.
- Creación, edición y asignación de grupos.
- Migración incremental y prueba pgTAP de Fase 2.

## Verificaciones ejecutadas

- TypeScript: correcto.
- ESLint: correcto.
- Pruebas del proyecto: 14 aprobadas.
- Build de producción: correcto.
- Rutas generadas: `/login`, `/registro`, `/cuenta-pendiente`,
  `/cuenta-inactiva`, `/cambiar-contrasena`, `/admin`,
  `/admin/docentes`, `/admin/grupos`, `/grupos`,
  `/fase-0/boleta-prueba` y `/api/estado`.

## Pendiente para activar la Fase 2

- Aplicar la migración `20260723000200` con `npm run db:push`.
- Ejecutar su prueba pgTAP localmente o desde SQL Editor.
- Crear y configurar una nueva `SUPABASE_SECRET_KEY` privada.
- Crear la primera administradora siguiendo
  `docs/fase-2-autenticacion-administracion.md`.
