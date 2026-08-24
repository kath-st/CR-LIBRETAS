# CR Libretas

Sistema web de gestión académica y generación de boletas de notas para la
I.E.P. Cristo Redentor de Nocheto.

La aplicación cubre el flujo completo desde la creación de cuentas docentes y
grupos hasta el registro de notas, recomendaciones, generación de PDF,
importaciones y respaldos.

## Funcionalidades

- acceso mediante DNI y contraseña;
- aprobación, activación y desactivación de cuentas docentes;
- contraseñas temporales con cambio obligatorio;
- creación de grupos y asignación de docentes;
- registro, importación, matrícula, retiro y reactivación de alumnos;
- malla de áreas y asignaturas configurable por grupo;
- registro de notas por asignatura o por alumno;
- autoguardado y cálculos académicos;
- recomendaciones asistidas y editables;
- vista previa A4 y PDF individual, por selección o grupal;
- almacenamiento privado e inmutable de boletas;
- importación de alumnos y notas desde XLSX/CSV, con vista previa para uno o varios grupos;
- exportación JSON y restauración transaccional;
- aislamiento entre grupos mediante Row Level Security de Supabase.

## Tecnologías

- Next.js 16 con App Router;
- React 19 y TypeScript estricto;
- Supabase Auth, PostgreSQL, Storage y RLS;
- Zod para validaciones;
- Chromium para generar los PDF;
- Node.js Test Runner y pgTAP;
- Docker para despliegue.

## Instalación local

```bash
git clone https://github.com/kath-st/CR-LIBRETAS.git
cd cr-libretas
npm ci
```

En Windows, crea el archivo de configuración local:

```powershell
Copy-Item .env.example .env.local
```

Completa `.env.local` sin modificar `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLICA
SUPABASE_SECRET_KEY=CLAVE_PRIVADA_DEL_SERVIDOR
CHROMIUM_EXECUTABLE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
```
Inicia el servidor:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Preparar Supabase

Inicia sesión, vincula el proyecto y revisa las migraciones:

```bash
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase migration list
npm run db:push
npx supabase migration list
```

Todas las migraciones locales deben aparecer también en la columna remota.
Consulta [supabase/README.md](supabase/README.md) para conocer su contenido y
las pruebas de base de datos.

En **Authentication → Providers → Email**:

1. habilita el acceso mediante email y contraseña;
2. deshabilita la confirmación por email.

El sistema convierte el DNI en un correo interno; no se envían mensajes a ese
correo.

### Primera cuenta administradora

1. Registra la cuenta desde `/registro`.
2. Abre el SQL Editor de Supabase.
3. Ejecuta una sola vez, reemplazando el DNI:

```sql
update public.profiles
set role = 'admin',
    status = 'activo'
where dni = 'DNI_DE_LA_DIRECTORA';
```

Las siguientes cuentas se aprueban desde el panel administrativo.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia Next.js en desarrollo. |
| `npm run check` | Comprueba TypeScript. |
| `npm run lint` | Ejecuta ESLint. |
| `npm test` | Ejecuta las pruebas de aplicación. |
| `npm run build` | Genera la compilación de producción. |
| `npm run validate` | Ejecuta tipos, lint, pruebas y compilación. |
| `npm run pdf:sample` | Genera una muestra PDF local. |
| `npm run pdf:validate` | Valida la muestra grupal de 30 páginas. |
| `npm run db:start` | Inicia Supabase local mediante Docker. |
| `npm run db:reset` | Recrea la base de datos local. |
| `npm run db:test` | Ejecuta las pruebas pgTAP locales. |
| `npm run db:push` | Aplica migraciones al proyecto Supabase vinculado. |

## Estructura principal

```text
src/app/                 Rutas, páginas y API de Next.js
src/components/          Componentes compartidos
src/domain/              Reglas y cálculos académicos
src/features/            Funcionalidades por dominio
src/lib/                 Supabase, autenticación, API y PDF
supabase/migrations/     Esquema, funciones y políticas RLS
supabase/tests/          Pruebas de seguridad e integridad
tests/                   Pruebas de aplicación
public/brand/            Recursos institucionales publicados
docs/referencias-boleta/ Originales utilizados para sincronizar la marca
docs/guia-rapida-docentes.md
                         Manual operativo
```
