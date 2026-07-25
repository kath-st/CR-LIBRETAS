# Especificación y plan integral de desarrollo

## Sistema web de generación de boletas de notas escolares

**Institución:** Institución Educativa Privada “Cristo Redentor de Nocheto”  
**Versión:** MVP 1  
**Documento:** Requisitos, arquitectura, fases integradas y guía para trabajar con Codex desde VS Code  
**Fecha de actualización:** 19 de julio de 2026

---

## 1. Objetivo

Construir una aplicación web privada, sencilla y segura para que la directora y las docentes puedan administrar grupos académicos, alumnos, áreas, asignaturas, notas bimestrales, recomendaciones, promedios, orden de mérito, boletas PDF y respaldos JSON.

El producto se limitará a la preparación de libretas o boletas de notas. No será una plataforma escolar integral.

### Capacidad esperada

- Una administradora.
- Hasta 15 docentes.
- Hasta 30 alumnos por grupo académico.
- Una sección por grado en la actualidad, normalmente denominada `Única`.
- Una docente puede ser responsable de varios grupos.

---

## 2. Alcance del MVP 1

El MVP incluirá:

- Educación Primaria y Secundaria.
- Registro, aprobación e inicio de sesión de docentes mediante DNI.
- Administración y asignación de grupos académicos.
- Registro manual e importación de alumnos desde XLSX y CSV.
- Retiro y reactivación de alumnos conservando su historial.
- Configuración de áreas y asignaturas por grupo.
- Registro de notas de cuatro bimestres.
- Autoguardado y validación de notas.
- Cálculo de promedios y orden de mérito por bimestre.
- Recomendaciones por alumno y bimestre.
- Vista previa de la boleta.
- PDF individual, grupal y por selección de alumnos.
- Archivos institucionales en Supabase Storage.
- Respaldo y restauración mediante JSON.

Quedan fuera del MVP:

- Nivel Inicial, aunque el modelo podrá contemplarlo para el futuro.
- Asistencia.
- Horarios.
- Pagos o pensiones.
- Mensajería con familias.
- Aula virtual.
- Tareas y evaluaciones detalladas.
- Matrícula administrativa o financiera.

---

## 3. Decisiones técnicas

- Next.js con App Router.
- React y TypeScript en modo estricto.
- Route Handlers para el backend HTTP.
- Supabase PostgreSQL, Auth y Storage.
- Row Level Security en las tablas expuestas.
- Zod para validar entradas, importaciones y respaldos.
- CSS Modules y variables CSS globales para la interfaz. Esta elección facilita reutilizar el CSS existente del login.
- Playwright con Chromium para generar los PDF en runtime de Node.js.
- `pdf-lib` solamente si fuera necesario unir o separar archivos.
- SheetJS/XLSX para Excel.
- PapaParse para CSV.
- Migraciones SQL versionadas; no depender de scripts pegados manualmente sin historial.
- Pruebas unitarias para cálculos y pruebas de integración para permisos y flujos críticos.

### Principio de desarrollo

No se construirá primero todo el backend y después todo el frontend. Se trabajará mediante módulos verticales:

```text
interfaz → validación → Route Handler → base de datos/RLS → respuesta visible → pruebas
```

Cada fase debe terminar con una función visible y utilizable.

---

## 4. Actores

### ACT-01. Administradora

La directora será la administradora y podrá:

- Aprobar, desactivar y reactivar docentes.
- Corregir datos de una docente.
- Asignar una contraseña temporal.
- Configurar la institución y los textos anuales.
- Administrar escudo, sello y marca de agua.
- Administrar el catálogo base de áreas y asignaturas.
- Crear grupos y asignarlos a docentes.
- Consultar todos los grupos.

### ACT-02. Docente o tutora

En este sistema, docente y tutora representan el mismo rol. Podrá:

- Iniciar sesión.
- Acceder únicamente a los grupos que tenga asignados.
- Administrar alumnos y matrículas de esos grupos.
- Configurar la malla del grupo.
- Registrar notas y recomendaciones.
- Consultar promedios y mérito.
- Generar boletas.
- Exportar y restaurar respaldos.

---

## 5. Conceptos y reglas fundamentales

### Grupo académico

Es la unidad principal de aislamiento de datos y contiene:

- Año académico.
- Nivel.
- Grado.
- Sección, con valor predeterminado `Única`.
- Docente responsable.
- Estado activo o inactivo.

Ejemplo: `2026 - Secundaria - 1ro - Única`.

Toda información académica deberá depender directa o indirectamente de `grupo_academico_id`.

### Matrícula

Es la relación entre un alumno y un grupo académico. El retiro afecta la matrícula y no elimina al alumno ni su historial.

### Notas

- Una nota no ingresada se almacena como `NULL`.
- Cero es una nota válida.
- Para el MVP, las notas son enteras de 0 a 20.
- Una nota se identifica por matrícula, asignatura configurada y bimestre.

### Datos derivados

Las notas son la fuente de verdad. Los promedios y el mérito se recalculan. Los resultados almacenados en PDFs o respaldos funcionan como fotografías históricas, no como una segunda fuente editable.

---

## 6. Requerimientos funcionales

### 6.1 Autenticación

#### RF-AUT-001. Registro

La docente podrá solicitar una cuenta ingresando nombres, apellidos, DNI, contraseña y confirmación.

#### RF-AUT-002. DNI

El DNI se guardará como texto, tendrá ocho dígitos, será único y será el identificador visible de acceso.

#### RF-AUT-003. Email interno

El sistema convertirá el DNI a un email sintético que no se mostrará en la interfaz. Ejemplo:

```text
12345678@usuarios.cristoredentor.edu.pe
```

#### RF-AUT-004. Contraseña

Tendrá al menos ocho caracteres y será administrada exclusivamente por Supabase Auth. Nunca se guardará en texto plano.

#### RF-AUT-005. Aprobación

Una cuenta nueva quedará `pendiente`. Solo podrá usar funciones académicas después de ser aprobada por la directora.

#### RF-AUT-006. Estados

Los estados serán `pendiente`, `activo` e `inactivo`.

#### RF-AUT-007. Recuperación

Como el email sintético no recibe correos, la administradora podrá asignar una contraseña temporal y la docente deberá cambiarla al ingresar.

#### RF-AUT-008. Sesión

El sistema permitirá iniciar y cerrar sesión, protegerá páginas privadas y redirigirá según rol y estado.

### 6.2 Administración de docentes

#### RF-ADM-001

La administradora verá las cuentas docentes y podrá aprobar, desactivar, reactivar, corregir sus datos y asignar una contraseña temporal.

#### RF-ADM-002

Una cuenta con historial no se eliminará; se desactivará.

#### RF-ADM-003

Una docente no podrá cambiar su rol, estado o grupos asignados.

### 6.3 Configuración institucional

#### RF-INS-001

La administradora configurará nombre institucional, dirección, lema, denominación oficial del año y textos de la boleta.

#### RF-INS-002

El año de la boleta será el año del grupo académico, no necesariamente el año calendario actual.

#### RF-INS-003

La denominación oficial del año será configurable y no estará escrita directamente en el código.

#### RF-INS-004

La administradora podrá subir o cambiar escudo, sello y marca de agua en JPG, JPEG o PNG. Las docentes solo podrán visualizarlos y utilizarlos.

### 6.4 Grupos académicos

#### RF-GRP-001

La administradora podrá crear grupos con año, nivel, grado, sección, docente, nombre visible y estado.

#### RF-GRP-002

El MVP habilitará Primaria y Secundaria. Inicial quedará preparado como ampliación futura, pero oculto en la interfaz.

#### RF-GRP-003

Primaria admitirá de primero a sexto y Secundaria de primero a quinto.

#### RF-GRP-004

Una docente podrá tener varios grupos. Cada grupo tendrá una docente responsable en el MVP.

#### RF-GRP-005

El grupo seleccionado aparecerá en la cabecera y en la URL, por ejemplo:

```text
/grupos/[grupoId]/notas
```

#### RF-GRP-006

No se podrá consultar, modificar, importar, calcular, exportar ni generar PDF sin un grupo seleccionado y autorizado.

### 6.5 Alumnos y matrículas

#### RF-ALU-001

La docente podrá registrar alumnos manualmente con apellidos y nombres. No se exigirá DNI del alumno.

#### RF-ALU-002

Podrá importar XLSX o CSV en formatos `apellidos_y_nombres` o `apellidos,nombres`.

#### RF-ALU-003

Antes de importar se mostrarán filas válidas, errores, posibles duplicados y total de registros.

#### RF-ALU-004

Un nombre repetido generará una advertencia, no un bloqueo absoluto.

#### RF-ALU-005

La confirmación de la importación será transaccional: se completa entera o no se aplica.

#### RF-ALU-006

Solo podrá eliminarse una matrícula creada por error si no tiene notas, recomendaciones, PDFs ni historial.

#### RF-ALU-007

Si existe historial, el alumno será retirado. Se guardarán fecha, bimestre desde el que deja de participar, motivo opcional y usuario responsable.

#### RF-ALU-008

Un alumno retirado conservará su historial, quedará fuera de nuevas boletas y méritos posteriores, podrá consultarse con un filtro y podrá reactivarse.

### 6.6 Áreas, asignaturas y malla

#### RF-MAL-001

Existirá un catálogo base de áreas y asignaturas y una configuración independiente para cada grupo.

#### RF-MAL-002

La docente podrá activar, desactivar, agregar y ordenar áreas y asignaturas, así como indicar qué áreas cuentan en el promedio final.

#### RF-MAL-003. Catálogo inicial

- Matemática: Aritmética, Álgebra, Geometría y Razonamiento Matemático.
- Comunicación Integral: Gramática, Ortografía, Comprensión Lectora y Razonamiento Verbal.
- Ciencia y Tecnología: Biología, Física y Química.
- Personal Social: Historia y Geografía.
- Áreas directas: Educación Física, Educación por el Arte, Educación Religiosa, Inglés, Computación y Conducta.

#### RF-MAL-004

Las áreas directas se representarán internamente mediante una asignatura única, pero en la boleta se mostrarán como áreas sin asignatura interna.

#### RF-MAL-005

Conducta podrá incluirse o excluirse del promedio final.

#### RF-MAL-006

Desactivar una asignatura con notas no eliminará su historial. La interfaz advertirá que el cambio puede modificar promedios y mérito.

### 6.7 Notas y autoguardado

#### RF-NOT-001

La pantalla de notas será similar a una hoja de cálculo, con filas por alumno/asignatura y columnas 1B, 2B, 3B, 4B, P y promedio global.

#### RF-NOT-002

Solo se aceptarán enteros entre 0 y 20 o una celda vacía representada por `NULL`.

#### RF-NOT-003

La interfaz mostrará `Guardando`, `Guardado` o `Error al guardar`.

#### RF-NOT-004

Una respuesta antigua del autoguardado no podrá sobrescribir una edición más reciente.

#### RF-NOT-005

Los cálculos visibles se actualizarán después de cada cambio válido.

### 6.8 Cálculos

#### RF-CAL-001. Promedio interno de asignatura

```text
suma de bimestres registrados / cantidad de bimestres registrados
```

Los valores `NULL` no participan y el cero sí participa.

#### RF-CAL-002. P visible

El P visible es el promedio interno de asignatura redondeado a entero.

#### RF-CAL-003. Área interna

Es el promedio de los P internos de las asignaturas activas que tengan notas. En un área directa equivale al P interno de su asignatura única.

#### RF-CAL-004. Promedio global visible

Es el promedio interno del área redondeado a entero.

#### RF-CAL-005. Promedio final interno

Es el promedio de los valores internos de las áreas activas marcadas para participar.

#### RF-CAL-006. Promedio final visible

Se mostrará con un decimal. No se redondearán resultados intermedios.

### 6.9 Orden de mérito

#### RF-MER-001

El mérito se calculará por grupo y por bimestre usando solamente las notas del bimestre evaluado, no el P acumulado.

#### RF-MER-002

El promedio del área para un bimestre será el promedio de las asignaturas con nota en ese bimestre. El promedio final del bimestre será el promedio de las áreas incluidas.

#### RF-MER-003

Se utilizará el valor interno sin redondear.

#### RF-MER-004

Los empates exactos compartirán puesto mediante ranking denso: `1, 2, 2, 3`.

#### RF-MER-005

Los alumnos retirados no participarán en bimestres posteriores al bimestre de retiro.

### 6.10 Recomendaciones

#### RF-REC-001

Existirá una recomendación por matrícula y bimestre, con un máximo de 300 caracteres en el MVP.

#### RF-REC-002

Se guardarán texto, docente y fecha de actualización mediante autoguardado o un botón con estado visible.

### 6.11 Vista previa y PDF

#### RF-VIS-001

La vista previa reutilizará los mismos datos, estructura y estilos de impresión que el PDF.

#### RF-VIS-002

Permitirá cambiar de alumno y advertirá si el contenido excede una página A4.

#### RF-PDF-001

Se podrá generar PDF individual, grupal y de uno o varios alumnos seleccionados.

#### RF-PDF-002

Cada alumno ocupará exactamente una página A4 vertical.

#### RF-PDF-003

Cada generación usará una fotografía consistente de grupo, alumno, malla, notas, cálculos, mérito, recomendación, configuración e imágenes.

#### RF-PDF-004

Los PDF serán inmutables y cada generación guardará UUID, fecha, usuario, grupo, bimestre o alcance, alumnos, tipo y ruta de Storage.

#### RF-PDF-005

Las rutas internas usarán UUID:

```text
{grupoId}/{generacionId}/grupo.pdf
{grupoId}/{generacionId}/alumnos/{matriculaId}.pdf
```

El nombre descargado podrá ser legible.

#### RF-PDF-006

El sistema nunca leerá un PDF anterior para recuperar datos editables.

### 6.12 Respaldo y restauración

#### RF-RES-001

La información se guardará en Supabase y persistirá después de cerrar la pestaña.

#### RF-RES-002

El respaldo JSON por grupo incluirá versión, fecha, grupo, alumnos activos y retirados, matrículas, malla, notas, recomendaciones, resultados informativos, configuración y metadatos de integridad.

#### RF-RES-003

El JSON se validará con Zod y los cálculos se volverán a generar desde las notas.

#### RF-RES-004

Al importar se ofrecerá restaurar en el mismo grupo, crear otro grupo o cancelar.

#### RF-RES-005

La restauración será transaccional. Restaurar en el mismo grupo exigirá confirmación y generará antes un respaldo automático.

---

## 7. Reglas de negocio

- **RN-001:** toda información académica depende de un grupo académico.
- **RN-002:** ninguna operación académica se ejecuta sin seleccionar y autorizar el grupo.
- **RN-003:** una docente solo accede a sus grupos; la administradora puede acceder a todos.
- **RN-004:** `NULL` significa nota no registrada y `0` es una nota válida.
- **RN-005:** no se elimina información con historial; se utilizan estados y retiro lógico.
- **RN-006:** la malla es independiente por grupo.
- **RN-007:** cambiar la malla no elimina notas existentes.
- **RN-008:** los cálculos internos conservan precisión y solo se redondea para mostrar.
- **RN-009:** el mérito se calcula por grupo y bimestre.
- **RN-010:** los retirados quedan fuera de periodos posteriores a su retiro.
- **RN-011:** cada PDF generado es inmutable.
- **RN-012:** el año visible en la boleta es el del grupo académico.
- **RN-013:** un respaldo nunca mezcla grupos.

---

## 8. Requerimientos no funcionales

### Seguridad

- **RNF-SEG-001:** RLS estará habilitado en todas las tablas académicas expuestas.
- **RNF-SEG-002:** la clave `service_role` nunca llegará al navegador ni se incluirá en Git.
- **RNF-SEG-003:** cada operación protegida validará sesión, estado, rol y acceso al grupo.
- **RNF-SEG-004:** no se confiará solamente en el `grupoId` enviado por el navegador.
- **RNF-SEG-005:** contraseñas y sesiones serán administradas por Supabase Auth.
- **RNF-SEG-006:** los buckets serán privados y se utilizarán políticas o URLs firmadas.
- **RNF-SEG-007:** el registro y el login tendrán protección contra intentos repetidos.

### Integridad

- **RNF-INT-001:** se utilizarán UUID, claves foráneas, `CHECK`, índices, restricciones únicas y marcas de tiempo.
- **RNF-INT-002:** importaciones y restauraciones serán transaccionales.
- **RNF-INT-003:** la base de datos impedirá relacionar matrícula y malla de grupos diferentes.
- **RNF-INT-004:** los cálculos vivirán en un único módulo utilizado por interfaz, vista previa y PDF.

### Rendimiento y confiabilidad

- **RNF-REN-001:** el sistema soportará 15 docentes, 30 alumnos por grupo, cuatro bimestres y la malla completa.
- **RNF-REN-002:** la edición se reflejará inmediatamente y se guardará con una espera breve.
- **RNF-REN-003:** los errores de guardado serán visibles y reintentables.
- **RNF-REN-004:** el PDF de 30 páginas se probará en el entorno real antes del lanzamiento.

### Usabilidad e interfaz

- **RNF-UI-001:** la interfaz será sencilla para personas con conocimientos informáticos básicos.
- **RNF-UI-002:** habrá una identidad visual coherente mediante variables de color, tipografía, radios, sombras y espaciados.
- **RNF-UI-003:** el grupo seleccionado estará siempre visible.
- **RNF-UI-004:** botones y acciones conservarán nombre, posición y apariencia entre módulos.
- **RNF-UI-005:** se mostrarán estados de carga, vacío, éxito y error.
- **RNF-UI-006:** las acciones destructivas pedirán confirmación y explicarán sus consecuencias.
- **RNF-UI-007:** los formularios mostrarán validaciones junto al campo correspondiente.
- **RNF-UI-008:** la navegación y el panel funcionarán en computadora y tableta. El móvil permitirá operaciones sencillas; la tabla de notas se priorizará para pantallas amplias.
- **RNF-UI-009:** la tabla de notas admitirá navegación por teclado.
- **RNF-UI-010:** el diseño existente del login se adaptará a componentes React sin cambiar su identidad visual, salvo ajustes de accesibilidad y respuesta a diferentes pantallas.

### PDF

- **RNF-PDF-001:** cada boleta cabrá en una página A4 vertical.
- **RNF-PDF-002:** se probará el máximo de asignaturas, nombres largos y 300 caracteres de recomendación.
- **RNF-PDF-003:** la plantilla usará medidas físicas en milímetros.
- **RNF-PDF-004:** colores, fondos y bordes se conservarán al imprimir.

### Mantenibilidad

- **RNF-MAN-001:** TypeScript estará en modo estricto.
- **RNF-MAN-002:** Zod centralizará las validaciones.
- **RNF-MAN-003:** el código se separará por módulos de negocio.
- **RNF-MAN-004:** la base se administrará con migraciones versionadas.
- **RNF-MAN-005:** las fórmulas tendrán pruebas unitarias.
- **RNF-MAN-006:** las políticas RLS tendrán pruebas con varias cuentas y grupos.

---

## 9. Modelo de datos mínimo

| Tabla | Responsabilidad principal |
|---|---|
| `profiles` | Datos visibles, DNI, rol y estado asociados a `auth.users` |
| `configuracion_institucional` | Textos generales y configuración por año |
| `assets_institucionales` | Metadatos y rutas del escudo, sello y marca de agua |
| `grupos_academicos` | Año, nivel, grado, sección, docente y estado |
| `alumnos` | Identidad básica del alumno |
| `matriculas` | Relación alumno-grupo, estado y retiro |
| `areas` | Catálogo base de áreas |
| `asignaturas` | Catálogo base y relación con áreas |
| `grupo_areas` | Activación, orden e inclusión en promedio por grupo |
| `grupo_asignaturas` | Activación y orden de asignaturas por grupo |
| `notas` | Nota por matrícula, asignatura del grupo y bimestre |
| `recomendaciones` | Recomendación por matrícula y bimestre |
| `resultados_merito` | Fotografía opcional de un ranking publicado |
| `pdfs_generados` | Historial y metadatos de cada generación |
| `respaldos_json` | Metadatos de respaldos almacenados |

No se creará una tabla editable de promedios como fuente de verdad.

---

## 10. Storage

Todos los buckets serán privados:

- `institutional-assets`: escudo, sello y marca de agua.
- `report-cards`: PDFs individuales, grupales y por selección.
- `group-backups`: respaldos JSON y respaldos automáticos previos a restauraciones.

---

## 11. Estructura de páginas

### Públicas

- `/login`
- `/registro`
- `/cuenta-pendiente`
- `/cambiar-password`

### Docente

- `/grupos`
- `/grupos/[grupoId]`
- `/grupos/[grupoId]/alumnos`
- `/grupos/[grupoId]/malla`
- `/grupos/[grupoId]/notas`
- `/grupos/[grupoId]/recomendaciones`
- `/grupos/[grupoId]/vista-previa`
- `/grupos/[grupoId]/pdf`
- `/grupos/[grupoId]/respaldo`

### Administración

- `/admin`
- `/admin/docentes`
- `/admin/grupos`
- `/admin/institucion`
- `/admin/assets`
- `/admin/catalogo-academico`

---

## 12. Route Handlers principales

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `POST /api/admin/docentes/[id]/aprobar`
- `POST /api/admin/docentes/[id]/desactivar`
- `POST /api/admin/docentes/[id]/reactivar`
- `POST /api/admin/docentes/[id]/password-temporal`
- `GET|POST /api/grupos`
- `GET|PATCH /api/grupos/[grupoId]`
- `GET|POST /api/grupos/[grupoId]/alumnos`
- `POST /api/grupos/[grupoId]/alumnos/importar/validar`
- `POST /api/grupos/[grupoId]/alumnos/importar/confirmar`
- `POST /api/grupos/[grupoId]/matriculas/[id]/retirar`
- `POST /api/grupos/[grupoId]/matriculas/[id]/reactivar`
- `DELETE /api/grupos/[grupoId]/matriculas/[id]`
- `GET|PUT /api/grupos/[grupoId]/malla`
- `GET|PUT /api/grupos/[grupoId]/notas`
- `GET|PUT /api/grupos/[grupoId]/recomendaciones`
- `GET /api/grupos/[grupoId]/merito`
- `POST /api/grupos/[grupoId]/pdf`
- `GET /api/grupos/[grupoId]/respaldo`
- `POST /api/grupos/[grupoId]/restaurar/validar`
- `POST /api/grupos/[grupoId]/restaurar/confirmar`
- `POST /api/admin/assets`
- `PUT /api/admin/configuracion-institucional`

Todo Route Handler protegido deberá validar sesión, estado, rol, autorización del grupo y entrada Zod.

---

## 13. Arquitectura de carpetas recomendada

```text
src/
  app/
    (auth)/
      login/
      registro/
      cuenta-pendiente/
      cambiar-password/
    (docente)/
      grupos/
        [grupoId]/
    admin/
    api/
  components/
    ui/
    layout/
    feedback/
  features/
    auth/
    docentes/
    grupos/
    alumnos/
    malla/
    notas/
    recomendaciones/
    merito/
    boletas/
    respaldos/
  lib/
    auth/
    calculos/
    pdf/
    storage/
    supabase/
  schemas/
  styles/
  types/
supabase/
  migrations/
  seed.sql
  tests/
tests/
  unit/
  integration/
  e2e/
docs/
  requisitos.md
  decisiones.md
  referencias-ui/
```

---

## 14. Diseño de la interfaz de la aplicación

La interfaz del sistema y la boleta PDF son dos productos visuales distintos.

### Interfaz web

Debe incluir:

- Login y registro.
- Panel docente con tarjetas de grupos.
- Panel administrativo.
- Navegación lateral o superior consistente.
- Migas o cabecera con el grupo actual.
- Formularios, tablas, filtros, modales y avisos reutilizables.
- Estados de carga, vacío, éxito y error.
- Diseño adaptable para computadora y tableta.

### Uso del CSS existente

El CSS del login se incorporará durante la Fase 1 y se conectará a la autenticación real en la Fase 2. Antes de usarlo se deberá entregar a Codex:

- Archivo CSS original.
- HTML o estructura original, si existe.
- Captura de pantalla del resultado esperado.
- Imágenes y fuentes utilizadas.

Codex deberá transformar esa estructura en componentes React/Next.js conservando el aspecto visual y corrigiendo accesibilidad, nombres de clases y adaptación a pantallas.

### Sistema visual mínimo

Antes de multiplicar pantallas se definirán variables para:

- Colores principales y secundarios.
- Colores de éxito, advertencia y error.
- Tipografía.
- Tamaños y pesos.
- Espaciados.
- Bordes, radios y sombras.
- Altura de campos y botones.
- Ancho del menú lateral.

No se diseñará cada pantalla con valores aislados.

---

## 15. Diseño de la boleta

La boleta tendrá escudo superior izquierdo, marca de agua centrada, sello inferior y marco exterior naranja con esquinas redondeadas.

El encabezado mostrará:

```text
Institución Educativa Privada
“CRISTO REDENTOR DE NOCHETO”
EDUCACIÓN PRIMARIA o EDUCACIÓN SECUNDARIA
DIOS, AMOR, DISCIPLINA
MZ J – LT 8 PSJ RASUÑITI SANTA ANITA
```

También mostrará la denominación configurable del año y `BOLETA DE NOTAS {año del grupo}`.

La tabla será:

```text
ÁREA | ASIGNATURA | 1B | 2B | 3B | 4B | P | PROM. GLOBAL
```

Estilos principales:

- Georgia, equivalente a 10 pt.
- Encabezados rojos.
- Áreas azul oscuro.
- Asignaturas moradas.
- Recomendaciones con título morado y texto negro.
- Promedio final, mérito y firma en negro.
- Encabezados de datos con fondo `#deeaf6`.
- Bordes negros.
- Marco naranja.
- Una página A4 vertical por alumno.

---

## 16. Plan integrado de implementación

Cada fase incluye frontend, backend y validación. No se avanzará a la siguiente mientras la anterior no cumpla su definición de terminado.

### Fase 0. Validación

**Dominio y cálculos:**

- Confirmar las reglas académicas.
- Crear casos verificables de cálculo.
- Diferenciar `NULL` de cero.
- Validar conservación de precisión y ranking denso.

**Boleta:**

- Diseñar una boleta estática con datos ficticios.
- Probar el caso de mayor contenido.
- Comprobar que la composición utiliza una página A4 vertical.
- Conservar escudo, sello, marca de agua y referencia de marco.

**Terminado cuando:**

- Las reglas y resultados esperados están versionados.
- Las pruebas de cálculo pasan.
- La boleta de máxima carga se renderiza y conserva una sola hoja A4.

### Fase 1. Base técnica e interfaz inicial

**Proyecto e interfaz:**

- Crear Next.js con App Router y TypeScript estricto.
- Configurar ESLint, alias `@/*`, CSS Modules y variables globales.
- Crear componentes básicos: botón, campo, tarjeta, mensaje, modal y cargador.
- Crear login, registro y cuenta pendiente sin presentar autenticación simulada
  como si fuera real.

**Supabase y datos iniciales:**

- Configurar clientes Supabase de navegador y servidor mediante cookies.
- Mantener valores reales en `.env.local` y ejemplos vacíos en `.env.example`.
- Crear migraciones versionadas.
- Crear configuración institucional inicial.
- Crear perfiles y grupos académicos mínimos para establecer el aislamiento.
- Implementar RLS en todas las tablas expuestas.
- Probar que una docente no puede consultar ni modificar un grupo ajeno.

**Terminado cuando:**

- Tipos, lint, pruebas y build terminan sin errores.
- Las tres pantallas de autenticación son visualmente utilizables.
- La boleta estática A4 puede revisarse desde el navegador.
- No hay claves privadas en el repositorio o en el frontend.
- La migración, seed y prueba RLS están versionados.
- La prueba de aislamiento entre grupos pasa en Supabase local.

### Fase 2. Base de datos y autenticación completa

**Frontend:**

- Conectar login y registro reales.
- Mostrar errores junto a cada campo.
- Crear redirecciones para pendiente, inactivo, admin y docente.
- Implementar cierre de sesión y cambio obligatorio de contraseña.

**Backend y datos:**

- Crear migraciones iniciales para perfiles y funciones de autorización.
- Implementar Supabase Auth con email sintético.
- Crear el registro seguro y el perfil `pendiente`.
- Crear el admin inicial mediante un procedimiento controlado.
- Implementar RLS inicial y gestión de sesiones.

**Pruebas:**

- DNI inválido y duplicado.
- Contraseña inválida.
- Cuenta pendiente e inactiva.
- Acceso a páginas protegidas sin sesión.

**Terminado cuando:**

- Una docente puede registrarse, quedar pendiente, ser aprobada e iniciar sesión.
- Cada rol llega a su panel correspondiente.

### Fase 2B. Paneles, docentes y grupos — completada

**Frontend:**

- Panel administrativo de docentes.
- Acciones aprobar, desactivar, reactivar y contraseña temporal.
- Formulario de grupos.
- Asignación de docente.
- Panel docente con tarjetas y botón `Trabajar libreta`.
- Layout del grupo con su contexto siempre visible.

**Backend y datos:**

- Tablas de configuración institucional, assets y grupos.
- Route Handlers y RLS de docentes/grupos.
- Restricción de acceso por docente asignada.

**Terminado cuando:**

- La directora asigna dos grupos a una docente.
- La docente solo ve esos grupos.
- Cambiar de URL a un grupo ajeno devuelve acceso denegado.

### Fase 3. Flujo académico básico

Esta fase consolida alumnos, matrículas, malla, notas, cálculos y
recomendaciones para que cada entrega termine con una libreta utilizable.

#### 3.1. Alumnos y matrículas

**Frontend:**

- Lista con filtros de activos y retirados.
- Formulario manual.
- Edición.
- Confirmaciones diferenciadas para eliminar y retirar.
- Reactivación.
- Estados vacíos, carga y errores.

**Backend y datos:**

- Tablas `alumnos` y `matriculas`.
- Detección de posibles duplicados.
- Reglas para eliminación segura y retiro.
- RLS por grupo.

**Terminado cuando:**

- Dos grupos contienen alumnos diferentes sin mezclarlos.
- Un alumno con historial no puede eliminarse.
- Retiro y reactivación conservan la información.

#### 3.2. Malla académica

**Frontend:**

- Pantalla para activar, desactivar y ordenar áreas/asignaturas.
- Formulario para agregar una asignatura.
- Control para incluir el área en el promedio.
- Advertencia al cambiar elementos con notas.

**Backend y datos:**

- Catálogos base, `grupo_areas` y `grupo_asignaturas`.
- Seed institucional inicial.
- Restricciones y RLS.

**Terminado cuando:**

- Dos grupos pueden tener mallas distintas.
- Conducta puede participar o no en el promedio.
- Las áreas directas se representan correctamente.

#### 3.3. Notas y cálculos

**Frontend:**

- Tabla editable por teclado.
- Columnas bimestrales y cálculos visibles.
- Autoguardado con estados claros.
- Protección contra cambios sin guardar y errores de red.

**Backend y datos:**

- Tabla de notas y actualización segura.
- Módulo único de cálculos.
- Control de concurrencia para no sobrescribir cambios nuevos.

**Pruebas:**

- `NULL` frente a cero.
- Uno, dos, tres y cuatro bimestres.
- Áreas directas y compuestas.
- Áreas excluidas.
- Precisión antes del redondeo.

**Terminado cuando:**

- Las notas persisten al cerrar y volver a entrar.
- Interfaz y pruebas producen los mismos resultados.

#### 3.4. Recomendaciones

**Frontend:**

- Selector de alumno y bimestre.
- Campo con contador de caracteres.

**Backend y datos:**

- Recomendaciones por matrícula/bimestre.
- Exclusión de retirados en periodos posteriores.

**Terminado cuando:**

- Las recomendaciones se guardan por bimestre.
- Los retiros posteriores no permiten crear recomendaciones nuevas.

### Fase 4. Vista previa y PDF

**Frontend:**

- Vista previa real.
- Selector de alumno.
- Selección individual, múltiple o grupo completo.
- Historial de PDFs.

**Backend:**

- Plantilla compartida por vista previa y PDF.
- Generación A4 con Playwright en Node.js.
- Almacenamiento privado e inmutable.
- Registro de la generación.

**Terminado cuando:**

- El caso de mayor contenido cabe en una página.
- Un grupo de 30 alumnos genera 30 páginas.
- La descarga y el historial funcionan.

### Fase 5. Importaciones y respaldos

**Frontend:**

- Carga de XLSX y CSV.
- Vista previa, errores y duplicados.
- Exportación JSON.
- Validación previa y confirmación de restauración.

**Backend:**

- Análisis y confirmación de importación.
- Esquema versionado de respaldo.
- Restauración transaccional.
- Respaldo automático antes de reemplazar datos.

**Terminado cuando:**

- Una importación inválida no deja datos parciales.
- Un respaldo exportado puede restaurarse y recalcularse.

### Fase 6. Seguridad, calidad y despliegue

**Frontend:**

- Revisión de accesibilidad y adaptación a pantallas.
- Mensajes y estados consistentes.
- Prueba con docentes reales.

**Backend y operación:**

- Pruebas completas de RLS.
- Revisión de secretos y logs.
- Pruebas de PDF en producción.
- Copias de seguridad y procedimiento de recuperación.
- Despliegue en un entorno compatible con Node.js y Chromium.

**Terminado cuando:**

- Se cumplen los criterios de aceptación.
- No existe acceso cruzado entre docentes o grupos.
- Una usuaria no técnica completa los flujos principales.

---

## 17. Criterios de aceptación del MVP

El MVP estará completo cuando sea posible:

1. Registrar una docente mediante DNI.
2. Aprobarla desde administración.
3. Iniciar y cerrar sesión.
4. Obligar a cambiar una contraseña temporal.
5. Asignarle dos grupos.
6. Cambiar entre grupos sin mezclar información.
7. Registrar, importar, retirar y reactivar alumnos.
8. Configurar una malla diferente por grupo.
9. Registrar notas de 0 a 20 y dejar notas vacías.
10. Cerrar la aplicación y recuperar lo guardado.
11. Calcular promedios sin redondeos intermedios.
12. Calcular mérito por bimestre y resolver empates.
13. Registrar recomendaciones por bimestre.
14. Previsualizar una boleta.
15. Generar PDF individual, múltiple y grupal.
16. Garantizar una página A4 por alumno.
17. Descargar y restaurar un respaldo JSON.
18. Demostrar mediante pruebas que una docente no accede a grupos ajenos.

---

## 18. Preparación antes de abrir Codex en VS Code

Crear o reunir dentro de la carpeta del proyecto:

```text
docs/requisitos.md                   ← este documento
docs/referencias-ui/login.css        ← CSS existente
docs/referencias-ui/login.html       ← si existe
docs/referencias-ui/login.png        ← captura del diseño esperado
docs/referencias-ui/                 ← otras capturas o referencias
public/brand/                        ← imágenes permitidas para desarrollo
```

También se necesita:

- Node.js LTS instalado.
- Git instalado.
- Una carpeta nueva para el repositorio.
- Una cuenta/proyecto de Supabase cuando comience la Fase 2.
- Las claves públicas de Supabase en `.env.local` cuando corresponda.
- La `service_role` solo en variables privadas del servidor y nunca dentro del código o de un mensaje a Codex.

No es necesario tener Supabase listo para construir la interfaz inicial de la Fase 1.

---

## 19. Primer encargo exacto para Codex desde VS Code

Entregar a Codex este documento, el CSS del login, su HTML si existe y una captura. Después usar este mensaje:

```text
Actúa como arquitecto full-stack senior y desarrollador experto en Next.js,
React y TypeScript.

Lee completamente docs/requisitos.md y revisa todos los archivos dentro de
docs/referencias-ui antes de modificar el proyecto.

Trabaja solamente en la Fase 1: proyecto base e interfaz inicial. No implementes
todavía la base de datos académica, RLS, alumnos, notas, cálculos, PDF ni respaldos.

Si la carpeta está vacía, crea una aplicación Next.js con App Router, TypeScript
estricto, ESLint, directorio src y alias @/*. Usa npm y CSS Modules con variables
CSS globales. Si el proyecto ya existe, inspecciónalo y conserva cualquier trabajo
válido de la usuaria.

Objetivos de esta fase:
1. Crear la estructura de carpetas indicada en el documento.
2. Crear los layouts público y privado básicos.
3. Definir variables globales de color, tipografía, espacios, radios y sombras.
4. Crear componentes reutilizables mínimos: Button, TextField, Card, Alert,
   Spinner y Modal.
5. Convertir el diseño de login proporcionado a componentes React accesibles,
   conservando su apariencia.
6. Crear las pantallas visuales /login, /registro y /cuenta-pendiente usando datos
   simulados, sin fingir que Supabase está conectado.
7. Crear .env.example sin valores secretos.
8. Añadir pruebas razonables para los componentes o validaciones creadas.
9. Ejecutar lint, comprobación de tipos, pruebas y build.

Antes de editar, dime brevemente qué encontraste y qué archivos planeas modificar.
Después implementa la fase completa. No avances a la Fase 2. No inventes nuevas
funcionalidades. Al terminar, informa qué quedó funcionando, qué verificaste y qué
datos necesitarás para iniciar la Fase 2.
```

### Resultado esperado del primer encargo

- Proyecto funcionando localmente.
- Login visualmente equivalente a la referencia.
- Registro y cuenta pendiente con el mismo sistema visual.
- Componentes reutilizables.
- Sin autenticación falsa presentada como real.
- Sin tablas académicas todavía.

---

## 20. Encargos siguientes para Codex

No se deben enviar todos juntos. Se usa uno después de revisar y aprobar la fase anterior.

### Encargo de la Fase 2

```text
Lee docs/requisitos.md y revisa el estado actual del repositorio. Implementa
solamente la Fase 2: base de datos inicial y autenticación completa.

Crea migraciones versionadas para profiles y las funciones mínimas de autorización.
Integra Supabase Auth mediante DNI y email sintético. Implementa registro pendiente,
login, logout, redirección por rol/estado, cambio obligatorio de contraseña temporal
y protección de rutas. Conecta las pantallas existentes sin rediseñarlas.

No implementes todavía grupos, alumnos, malla, notas ni PDF. Nunca expongas la
service_role al navegador. Añade pruebas de los casos indicados en la Fase 2,
ejecuta lint, tipos, pruebas y build, y documenta los pasos manuales necesarios en
Supabase.
```

### Encargo de la Fase 3

```text
Implementa solamente la Fase 3: flujo académico básico. Incluye registro manual
de alumnos, matrículas, retiro y reactivación, malla independiente por grupo,
notas de cuatro bimestres, cálculos sin redondeos intermedios y recomendaciones
por alumno/bimestre. Respeta NULL como vacío, cero como nota válida, enteros de
0 a 20 y un máximo de 300 caracteres. Añade migración, catálogo inicial, RLS,
integridad entre grupos, autoguardado versionado, interfaz y pruebas. No avances
a importaciones, PDF ni respaldos.
```

### Encargo de la Fase 4

```text
Implementa solamente la Fase 4: vista previa, orden de mérito y generación de
PDF. Reutiliza una única plantilla de datos y estilos. Usa valores internos para
el mérito, ranking denso, una página A4 vertical por alumno y almacenamiento
privado e inmutable. Prueba el caso de máximo contenido y un grupo de 30 alumnos.
No leas datos desde PDF.
```

### Encargo de la Fase 5

```text
Implementa solamente la Fase 5: importación XLSX/CSV con vista previa y
confirmación, exportación JSON y restauración validada y transaccional. Ningún
error debe dejar datos parciales. El respaldo tendrá versión y los promedios se
recalcularán desde las notas.
```

### Encargo de la Fase 6

```text
Ejecuta solamente la Fase 6: revisión integral de seguridad, RLS, accesibilidad,
experiencia de usuario, rendimiento, PDF en el entorno objetivo y preparación de
despliegue. No agregues nuevas funciones. Corrige únicamente defectos que impidan
cumplir los RF, RN, RNF y criterios de aceptación del documento.
```

---

## 21. Reglas para todos los encargos a Codex

Añadir o conservar estas reglas en cada fase:

- Leer el documento y el repositorio antes de editar.
- Trabajar solamente en la fase solicitada.
- No reescribir archivos válidos sin necesidad.
- No borrar cambios de la usuaria.
- No inventar funcionalidades.
- No colocar secretos en código, documentación, commits o frontend.
- Crear migraciones reversibles y versionadas.
- Aplicar autorización en servidor y RLS; ocultar botones no sustituye seguridad.
- Reutilizar componentes y evitar duplicar fórmulas.
- Mostrar errores comprensibles en la interfaz.
- Ejecutar lint, tipos, pruebas y build antes de declarar una fase terminada.
- Explicar cualquier paso manual que deba realizarse en Supabase.
- Detenerse al terminar la fase y esperar revisión.

---

## 22. Orden inmediato recomendado

1. Crear una carpeta nueva para el proyecto y abrirla en VS Code.
2. Guardar este archivo como `docs/requisitos.md`.
3. Copiar el CSS, HTML, captura e imágenes del login a `docs/referencias-ui`.
4. Inicializar Git si todavía no existe.
5. Abrir Codex desde esa carpeta.
6. Enviar únicamente el encargo de la Fase 1.
7. Ejecutar y revisar visualmente el proyecto.
8. Corregir la interfaz inicial antes de conectar Supabase.
9. Crear o preparar el proyecto Supabase.
10. Enviar el encargo de la Fase 2.

El frontend comienza en la Fase 1. La conexión real con Supabase empieza en la Fase 2. A partir de la Fase 3, cada módulo se construye de extremo a extremo con su interfaz, backend, datos, seguridad y pruebas.

---

## 23. Referencias visuales confirmadas para la Fase 0

Los siguientes archivos forman parte de la referencia oficial del proyecto:

- `login.svg`: referencia visual del acceso; deberá reconstruirse con React y CSS Modules, no insertarse como una pantalla SVG completa.
- `borde-de-la-libreta.png`: referencia del marco exterior naranja; se reproducirá con CSS para conservar nitidez en A4.
- `escudo.png`: escudo del encabezado institucional.
- `escudo-transparente-de-fondo.png`: marca de agua centrada de la boleta.
- `sello-institucional.png`: sello ubicado en la zona inferior.
- Modelo completo de boleta: referencia principal de colores, proporciones y distribución.
- Modelo vacío de boleta: referencia para la geometría de tablas y espacios.

### Reglas específicas para el login

- Omitir por completo `Help`, `Contact us`, `English` y el `Sign up` original de la plantilla.
- Conservar solamente escudo, identificación institucional, DNI, contraseña, mostrar/ocultar contraseña, `Ingresar`, `Crear cuenta docente` y mensajes de estado.
- `Crear cuenta docente` será una acción propia del sistema en español; no una copia del `Sign up` decorativo.
- Mantener lo máximo posible la composición, colores, formas, tamaños y espaciados de la referencia.
- Corregir accesibilidad y adaptación a computadora, tableta y móvil.
- No presentar autenticación simulada como si ya estuviera conectada a Supabase.

### Reglas específicas para la boleta

- Conservar desde la Fase 1 todos los recursos sin implementar todavía el PDF.
- No mezclar el estilo de la interfaz web con el diseño impreso de la boleta.
- Mantener los recursos como archivos independientes y reemplazables.
- Implementar la plantilla y el PDF en la Fase 8 usando estas referencias como fuente visual principal.
