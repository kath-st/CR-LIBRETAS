import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateStudentResult,
  calculateTermAverage,
} from "../src/domain/academic/calculations.ts";
import { SaveVersionTracker } from "../src/domain/academic/autosave.ts";

const root = new URL("../", import.meta.url);

test("las fórmulas cubren de uno a cuatro bimestres sin redondeo intermedio", () => {
  const areas = [{ active: true, id: "a1", includedInFinal: true }];
  const subjects = [{ active: true, areaId: "a1", id: "s1" }];

  for (const [scores, expected] of [
    [[11], 11],
    [[11, 12], 11.5],
    [[11, 12, 13], 12],
    [[11, 12, 13, 14], 12.5],
  ]) {
    const grades = scores.map((score, index) => ({
      score,
      subjectId: "s1",
      term: index + 1,
    }));
    const result = calculateStudentResult(areas, subjects, grades);
    assert.equal(result.subjectAverages.s1, expected);
  }
});

test("áreas directas, compuestas y excluidas producen el promedio esperado", () => {
  const areas = [
    { active: true, id: "directa", includedInFinal: true },
    { active: true, id: "compuesta", includedInFinal: true },
    { active: true, id: "excluida", includedInFinal: false },
  ];
  const subjects = [
    { active: true, areaId: "directa", id: "d1" },
    { active: true, areaId: "compuesta", id: "c1" },
    { active: true, areaId: "compuesta", id: "c2" },
    { active: true, areaId: "excluida", id: "x1" },
  ];
  const grades = [
    { score: 10, subjectId: "d1", term: 1 },
    { score: 10, subjectId: "c1", term: 1 },
    { score: 20, subjectId: "c2", term: 1 },
    { score: 20, subjectId: "x1", term: 1 },
  ];

  const result = calculateStudentResult(areas, subjects, grades);
  assert.equal(result.areaAverages.directa, 10);
  assert.equal(result.areaAverages.compuesta, 15);
  assert.equal(result.areaAverages.excluida, 20);
  assert.equal(result.finalInternal, 12.5);
  assert.equal(calculateTermAverage(1, areas, subjects, grades), 12.5);
});

test("el autoguardado ignora respuestas antiguas de la misma celda", () => {
  const tracker = new SaveVersionTracker();
  const first = tracker.next("alumno:curso:1");
  const second = tracker.next("alumno:curso:1");

  assert.equal(first, 1);
  assert.equal(second, 2);
  assert.equal(tracker.isCurrent("alumno:curso:1", first), false);
  assert.equal(tracker.isCurrent("alumno:curso:1", second), true);
  assert.equal(tracker.next("otra-celda"), 1);
});

test("la regla de retiro excluye matrículas de notas y se refuerza en PostgreSQL", async () => {
  const [gradebook, recommendations, migration, databaseTest] =
    await Promise.all([
      readFile(
        new URL("src/features/academic/Gradebook.tsx", root),
        "utf8",
      ),
      readFile(
        new URL("src/features/academic/Recommendations.tsx", root),
        "utf8",
      ),
      readFile(
        new URL(
          "supabase/migrations/20260724000200_phase_6_withdrawal_enforcement.sql",
          root,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "supabase/tests/database/006_phase_6_final_validation.test.sql",
          root,
        ),
        "utf8",
      ),
    ]);

  assert.match(gradebook, /\.eq\("status", "activo"\)/);
  assert.match(recommendations, /term <= enrollment\.withdrawn_from_term/);
  assert.match(migration, /grades_enforce_enrollment_term/);
  assert.match(migration, /recommendations_enforce_enrollment_term/);
  assert.match(databaseTest, /El alumno no participa después/);
});

test("el repositorio incluye operación, validación PDF y prueba integral RLS", async () => {
  await Promise.all(
    [
      "README.md",
      "docs/guia-rapida-docentes.md",
      "scripts/validate-report-pdf.py",
      "supabase/migrations/20260724000300_phase_6_restore_variable_resolution.sql",
      "supabase/tests/database/006_phase_6_final_validation.test.sql",
    ].map((file) => access(new URL(file, root))),
  );
});
