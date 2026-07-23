# CR Libretas

Sistema de boletas de la I.E.P. Cristo Redentor de Nocheto. Las Fases 0, 1 y
2 incluyen validación académica, base técnica, autenticación y administración.

## Qué está incluido

- reglas académicas y casos de cálculo verificables;
- boleta estática A4 con datos ficticios en `/fase-0/boleta-prueba`;
- interfaz responsive de inicio de sesión;
- solicitud de cuenta docente;
- pantalla de cuenta pendiente de aprobación;
- componentes visuales reutilizables;
- validaciones con Zod y accesibilidad básica;
- clientes Supabase para navegador y servidor;
- migración inicial, datos institucionales, RLS y prueba de aislamiento;
- registro y login real mediante DNI y email interno;
- aprobación, desactivación y reactivación de docentes;
- recuperación mediante contraseña temporal con cambio obligatorio;
- panel administrativo para crear y asignar grupos;
- referencias institucionales y requisitos dentro de `docs/`.

La migración de la Fase 2 debe aplicarse al proyecto Supabase antes de probar
los nuevos flujos. Las acciones administrativas de Supabase Auth requieren una
clave privada moderna guardada únicamente como `SUPABASE_SECRET_KEY` en
`.env.local`.

## Abrir en VS Code

1. Abre esta carpeta completa en VS Code.
2. Abre la terminal integrada.
3. Ejecuta `npm install`.
4. Ejecuta `npm run dev`.
5. Visita `http://localhost:3000`.

Las claves públicas se guardan en `.env.local`. Nunca se debe colocar una
`service_role` en variables `NEXT_PUBLIC_*`.

## Comprobaciones

- `npm run check`: comprueba TypeScript.
- `npm run lint`: revisa decisiones de seguridad y alcance.
- `npm test`: verifica las páginas y contenidos de la Fase 1.
- `npm run build`: confirma que la aplicación se puede compilar.
- `npm run db:test`: comprueba RLS con Supabase local y Docker.
- `npm run db:push`: aplica las migraciones pendientes al Supabase vinculado.

## Dónde continuar

- Requisitos y plan: `docs/requisitos.md`.
- Cierre de Fase 0: `docs/fase-0-validacion.md`.
- Base Supabase: `supabase/README.md`.
- Puesta en marcha de Fase 2: `docs/fase-2-autenticacion-administracion.md`.
- Referencias visuales: `docs/referencias-ui/` y `public/brand/`.
