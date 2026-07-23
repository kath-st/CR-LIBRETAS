# Fase 0 — Validación cerrada

## Reglas académicas confirmadas

- Las notas son números enteros de 0 a 20.
- `NULL` significa nota no ingresada y no participa en el promedio.
- Cero es una nota válida y sí participa.
- El promedio interno de una asignatura usa únicamente los bimestres registrados.
- El valor `P` visible es el promedio interno de la asignatura redondeado a entero.
- El promedio interno del área usa los promedios internos de sus asignaturas activas con notas.
- No se redondean los resultados intermedios.
- El promedio final visible se presenta con un decimal.
- Conducta puede incluirse o excluirse del promedio final.
- El mérito se calcula por bimestre, con valores internos y ranking denso.
- Un alumno retirado deja de participar desde los bimestres posteriores al retiro.

## Casos verificables

Los datos de prueba están versionados en
`tests/fixtures/academic-calculation-cases.json` y son ejecutados por
`tests/academic-rules.test.mjs`.

Incluyen:

1. Cuatro bimestres completos.
2. Bimestres pendientes representados por `NULL`.
3. Nota cero incluida en el cálculo.
4. Asignatura sin notas.
5. Conservación de decimales internos.
6. Promedio final visible con un decimal.
7. Empate con ranking denso `1, 2, 2, 3`.
8. Rechazo de notas decimales o fuera del rango 0–20.

## Boleta estática de máxima carga

La ruta `/fase-0/boleta-prueba` contiene datos ficticios, todas las secciones
visuales relevantes, recomendación extensa, firma, sello, marca de agua y una
malla amplia.

La hoja utiliza medidas físicas A4 (`210 mm × 297 mm`) y reglas de impresión.
Esta pantalla es una validación visual; todavía no guarda datos ni genera el PDF
definitivo. La generación automatizada e inmutable se implementará en la fase
de PDF.

## Criterio de cierre

La Fase 0 queda cerrada cuando:

- las pruebas de reglas pasan;
- la ruta de la boleta se renderiza;
- la compilación termina sin errores;
- la hoja de máxima carga conserva una sola página A4 al imprimir.
