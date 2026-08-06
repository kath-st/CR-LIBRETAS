# Guía rápida para docentes

## 1. Ingresar

1. Abre el sistema e ingresa tu DNI y contraseña.
2. Si recibiste una contraseña temporal, crea una nueva cuando el sistema lo
   solicite.
3. En **Mis grupos**, elige la libreta que vas a trabajar.

Nunca compartas tu contraseña. Si no ves un grupo, comunícalo a la directora;
no intentes trabajar desde el grupo de otra docente.

## 2. Registrar alumnos

En **Alumnos** puedes:

- registrar una alumna manualmente;
- importar un archivo XLSX o CSV;
- revisar posibles duplicados antes de confirmar;
- retirar o reactivar una matrícula.

Retirar no elimina el historial. Indica desde qué bimestre dejó de participar.
El sistema bloqueará notas y recomendaciones posteriores.

## 3. Revisar la malla

En **Malla**:

- activa solo las áreas y asignaturas que correspondan;
- usa **Orden** para decidir su posición en la boleta;
- confirma si cada área participa en el promedio final.

Haz esta revisión antes de ingresar notas.

## 4. Registrar notas

1. Entra en **Notas**.
2. Elige **Por asignatura** para calificar el mismo curso a todos los alumnos, o
   **Por alumno** para completar todos los cursos de una sola persona.
3. Selecciona la asignatura o el alumno correspondiente.
4. Escribe notas enteras de 0 a 20.
5. Deja la celda vacía si todavía no existe una nota. El cero sí es una nota.
6. Espera el mensaje **Todos los cambios guardados** antes de cerrar.

Puedes usar Enter o las flechas para avanzar por la columna. Si una celda muestra
error, corrígela y sal de ella para reintentar. Las matrículas retiradas no
aparecen en la pantalla de notas; su historial se conserva en **Alumnos**.

### Importar notas desde Excel o CSV

1. Descarga la **Plantilla de este grupo** o la **Plantilla de varios grupos**.
2. Completa 1B, 2B, 3B y 4B con enteros de 0 a 20. No cambies las columnas de
   identificadores de la plantilla.
3. Selecciona si deseas actualizar notas, completar solo celdas vacías o
   reemplazar los bimestres incluidos.
4. Sube el archivo y revisa cada error, alumno nuevo y reemplazo detectado.
5. Selecciona únicamente las filas correctas y confirma la importación.

Una celda vacía del archivo no modifica la nota guardada. Escribe **BORRAR**
para limpiarla explícitamente. La opción **Reemplazar los bimestres incluidos**
limpia primero todo el bimestre de cada grupo detectado, por lo que debe usarse
solo con una plantilla completa. El sistema crea un respaldo automático antes
de reemplazar información.

## 5. Consultar el orden de mérito

En **Mérito**:

1. selecciona el bimestre que deseas revisar;
2. consulta el puesto, promedio y cantidad de notas de cada alumno;
3. completa las notas pendientes cuando un resultado aparezca como provisional.

El orden utiliza únicamente las notas del bimestre seleccionado. Los empates
exactos comparten puesto (`1, 2, 2, 3`) y los alumnos retirados dejan de
participar después de su bimestre de retiro. Un alumno con notas incompletas
puede aparecer en el ranking, pero su puesto se identifica como provisional.

## 6. Escribir recomendaciones

En **Recomendaciones**:

1. Selecciona alumna y bimestre.
2. Revisa el promedio, orden de mérito y cantidad de notas registradas.
3. Marca hasta tres fortalezas o aspectos por mejorar.
4. Presiona **Generar borrador**.
5. Revisa el texto y elige **Usar esta sugerencia**.
6. Modifica libremente la recomendación final.
7. Presiona **Guardar recomendación**.

El generador nunca deduce conductas desde las notas ni reemplaza un texto
existente sin confirmación. Si faltan notas, deberás confirmar que comprendes
que el promedio y el puesto son provisionales. Cada bimestre conserva su propio
texto de hasta 300 caracteres.

## 7. Generar boletas

En **Boletas**:

1. revisa la vista previa;
2. elige una alumna, varias o todo el grupo;
3. descarga el PDF;
4. comprueba que el historial muestre el archivo generado.

Los PDFs históricos no cambian aunque después se editen notas.

## 8. Crear un respaldo

En **Respaldos**, descarga un JSON antes de cambios importantes. Para restaurar:

1. selecciona el archivo;
2. revisa el resumen;
3. confirma el modo de restauración;
4. escribe la frase solicitada.

Al restaurar el mismo grupo o reemplazar notas mediante una importación se
guarda automáticamente su estado anterior.

## 9. Si algo falla

- No presiones repetidamente el mismo botón mientras diga **Guardando**.
- Lee el mensaje rojo completo.
- Actualiza una sola vez si la conexión se interrumpió.
- Anota el grupo, pantalla y hora del problema.
- No edites manualmente los JSON ni los PDF.
- Entrega esa información a la directora o responsable del sistema.
