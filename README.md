# CR Libretas

Sistema web de gestión académica desarrollado para la **I.E.P. Cristo
Redentor de Nocheto**.

CR Libretas centraliza la administración de docentes, grupos, alumnos,
asignaturas y calificaciones. Automatiza los cálculos académicos y genera
libretas de notas en PDF listas para revisar, descargar e imprimir.

## Funcionalidades principales

- Gestión de cuentas docentes y permisos administrativos.
- Creación de grupos, matrícula y seguimiento de alumnos.
- Configuración de áreas y asignaturas para cada grupo.
- Registro de notas por asignatura o por alumno, con autoguardado.
- Cálculo automático de promedios y orden de mérito.
- Elaboración de recomendaciones editables para cada alumno.
- Generación de libretas A4 individuales, por selección o por grupo.
- Importación de alumnos y notas desde archivos XLSX o CSV.
- Exportación y restauración de respaldos JSON.
- Protección y separación de la información por docente y grupo.

## Tecnologías utilizadas

| Tecnología | Uso en el proyecto |
| --- | --- |
| **Next.js 16** | Aplicación web, navegación y servicios API mediante App Router. |
| **React 19** | Construcción de la interfaz y sus componentes interactivos. |
| **TypeScript** | Tipado estricto y prevención de errores durante el desarrollo. |
| **Supabase Auth** | Inicio de sesión y administración de cuentas docentes. |
| **PostgreSQL** | Almacenamiento de grupos, alumnos, notas y configuración académica. |
| **Supabase Storage** | Almacenamiento privado de libretas PDF y respaldos. |
| **Row Level Security** | Control de acceso y aislamiento de datos entre docentes y grupos. |
| **Zod** | Validación de formularios, importaciones y solicitudes al servidor. |
| **Chromium** | Conversión de las libretas HTML a documentos PDF A4. |
| **Node.js Test Runner y pgTAP** | Pruebas de lógica académica, integridad y seguridad. |
| **Docker y Render** | Entorno reproducible y despliegue de la aplicación. |

## Arquitectura general

```text
Docentes y administración
          │
          ▼
 Aplicación Next.js
  interfaz + servicios API
          │
          ▼
 Supabase Auth y PostgreSQL
          │
          ├── alumnos, grupos y notas
          ├── cálculos y recomendaciones
          └── políticas de seguridad RLS
          │
          ▼
 Supabase Storage + Chromium
  respaldos y libretas PDF
```

## Seguridad e integridad

La aplicación utiliza autenticación y políticas de seguridad directamente en
la base de datos. Cada docente puede acceder únicamente a los grupos que tiene
asignados, mientras que las funciones administrativas permanecen restringidas.

Las notas son la fuente de los cálculos académicos. Los promedios se generan
sin redondeos intermedios y cada libreta PDF se conserva como una fotografía
histórica inmutable del momento en que fue creada.

## Instalación rápida

Requiere Node.js 22 o una versión posterior.

```bash
git clone https://github.com/kath-st/CR-LIBRETAS.git
cd CR-LIBRETAS
npm ci
```

En Windows, crea la configuración local a partir del ejemplo:

```powershell
Copy-Item .env.example .env.local
```

Completa las variables de Supabase y la ruta de Chromium en `.env.local` y
ejecuta:

```bash
npm run dev
```

La aplicación estará disponible en
[http://localhost:3000](http://localhost:3000).

## Validación del proyecto

```bash
npm run validate
```

Este comando comprueba TypeScript, ejecuta ESLint y las pruebas automatizadas,
y genera la compilación de producción.

También están disponibles los siguientes comandos:

| Comando | Descripción |
| --- | --- |
| `npm run pdf:sample` | Genera una libreta PDF de muestra. |
| `npm run pdf:validate` | Valida un PDF grupal de 30 páginas. |
| `npm run db:start` | Inicia Supabase local mediante Docker. |
| `npm run db:reset` | Recrea la base de datos local. |
| `npm run db:test` | Ejecuta las pruebas pgTAP. |
| `npm run db:push` | Aplica las migraciones al proyecto Supabase vinculado. |

## Estructura principal

```text
src/app/                 Páginas, rutas y servicios API
src/components/          Componentes compartidos de interfaz
src/domain/              Reglas y cálculos académicos
src/features/            Módulos funcionales de la aplicación
src/lib/                 Integraciones, autenticación y generación PDF
supabase/migrations/     Esquema y políticas de seguridad
supabase/tests/          Pruebas de integridad y acceso
tests/                   Pruebas automatizadas de la aplicación
public/brand/            Recursos gráficos institucionales
docs/                    Requisitos y documentación de uso
```

## Documentación

- [Guía rápida para docentes](docs/guia-rapida-docentes.md)
- [Configuración y migraciones de Supabase](supabase/README.md)
- [Requisitos y arquitectura del sistema](docs/requisitos.md)

## Estado del proyecto

El sistema incluye el flujo académico principal: administración de cuentas y
grupos, gestión de alumnos, malla académica, registro de notas, mérito,
recomendaciones, importaciones, respaldos y generación de libretas PDF.
