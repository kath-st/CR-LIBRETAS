import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildGradeImportRows,
  normalizeImportText,
} from "../src/features/imports/grade-import.ts";

const root = new URL("../", import.meta.url);

test("el formato plano acepta un grupo y cuatro bimestres", () => {
  const rows = buildGradeImportRows([
    {
      name: "Notas",
      rows: [
        [
          "año",
          "nivel",
          "grado",
          "sección",
          "apellidos",
          "nombres",
          "área",
          "asignatura",
          "1B",
          "2B",
          "3B",
          "4B",
        ],
        [
          2026,
          "Primaria",
          "3ro",
          "Única",
          "Pérez Soto",
          "Ana María",
          "Matemática",
          "Aritmética",
          0,
          17,
          "BORRAR",
          20,
        ],
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].academicYear, 2026);
  assert.equal(rows[0].grade, 3);
  assert.deepEqual(
    rows[0].changes.map(({ action, score, term }) => ({ action, score, term })),
    [
      { action: "set", score: 0, term: 1 },
      { action: "set", score: 17, term: 2 },
      { action: "clear", score: null, term: 3 },
      { action: "set", score: 20, term: 4 },
    ],
  );
});

test("las plantillas omiten filas sin notas y señalan valores inválidos", () => {
  const rows = buildGradeImportRows([
    {
      name: "Grupo A",
      rows: [
        ["apellidos_y_nombres", "curso", "B1", "B2"],
        ["Pérez Soto, Ana", "Geometría", "", ""],
        ["Pérez Soto, Ana", "Geometría", 21, 15.5],
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].lastNames, "Pérez Soto");
  assert.equal(rows[0].firstNames, "Ana");
  assert.equal(rows[0].parseErrors.length, 2);
});

test("la normalización de coincidencias ignora mayúsculas y tildes", () => {
  assert.equal(normalizeImportText("  Comunicación ÍNTEGRAL "), "comunicacion integral");
});

test("la importación de notas incluye interfaz, API y migración", async () => {
  const required = [
    "src/features/imports/GradeImport.tsx",
    "src/features/imports/grade-import.ts",
    "src/features/imports/grade-import-server.ts",
    "src/app/api/grades/import/route.ts",
    "src/app/api/grades/import/template/route.ts",
    "supabase/migrations/20260805000100_grade_import.sql",
    "supabase/tests/database/007_grade_import.test.sql",
  ];
  await Promise.all(required.map((file) => access(new URL(file, root))));

  const sql = await readFile(
    new URL("supabase/migrations/20260805000100_grade_import.sql", root),
    "utf8",
  );
  assert.match(sql, /create or replace function public\.import_grades/i);
  assert.match(sql, /antes_de_importar_notas/i);
  assert.match(sql, /app_private\.can_access_group/i);
});
