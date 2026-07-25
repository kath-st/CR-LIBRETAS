import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateStudentResult,
  calculateTermAverage,
} from "../src/domain/academic/calculations.ts";

const root = new URL("../", import.meta.url);

test("la Fase 3 incluye sus rutas, migración y módulos visibles", async () => {
  const required = [
    "src/app/(dashboard)/grupos/[groupId]/page.tsx",
    "src/app/(dashboard)/grupos/[groupId]/alumnos/page.tsx",
    "src/app/(dashboard)/grupos/[groupId]/malla/page.tsx",
    "src/app/(dashboard)/grupos/[groupId]/notas/page.tsx",
    "src/app/(dashboard)/grupos/[groupId]/recomendaciones/page.tsx",
    "src/features/academic/StudentsManagement.tsx",
    "src/features/academic/CurriculumManagement.tsx",
    "src/features/academic/Gradebook.tsx",
    "src/features/academic/Recommendations.tsx",
    "supabase/migrations/20260723000300_phase_3_academic_flow.sql",
    "supabase/tests/database/003_phase_3_academic_flow.test.sql",
  ];

  await Promise.all(required.map((file) => access(new URL(file, root))));
});

test("los cálculos usan notas internas y excluyen áreas configuradas", () => {
  const areas = [
    { active: true, id: "a1", includedInFinal: true },
    { active: true, id: "a2", includedInFinal: false },
  ];
  const subjects = [
    { active: true, areaId: "a1", id: "s1" },
    { active: true, areaId: "a1", id: "s2" },
    { active: true, areaId: "a2", id: "s3" },
  ];
  const grades = [
    { score: 10, subjectId: "s1", term: 1 },
    { score: 0, subjectId: "s1", term: 2 },
    { score: 20, subjectId: "s2", term: 1 },
    { score: 20, subjectId: "s2", term: 2 },
    { score: 15, subjectId: "s3", term: 1 },
  ];

  const result = calculateStudentResult(areas, subjects, grades);
  assert.equal(result.subjectAverages.s1, 5);
  assert.equal(result.areaAverages.a1, 12.5);
  assert.equal(result.areaAverages.a2, 15);
  assert.equal(result.finalInternal, 12.5);
  assert.equal(result.finalVisible, 12.5);
});

test("el promedio bimestral conserva precisión y cero participa", () => {
  const score = calculateTermAverage(
    1,
    [{ active: true, id: "a1", includedInFinal: true }],
    [
      { active: true, areaId: "a1", id: "s1" },
      { active: true, areaId: "a1", id: "s2" },
    ],
    [
      { score: 0, subjectId: "s1", term: 1 },
      { score: 15, subjectId: "s2", term: 1 },
    ],
  );

  assert.equal(score, 7.5);
});

test("la migración aplica RLS e integridad por grupo", async () => {
  const sql = await readFile(
    new URL(
      "supabase/migrations/20260723000300_phase_3_academic_flow.sql",
      root,
    ),
    "utf8",
  );

  for (const table of [
    "students",
    "enrollments",
    "group_areas",
    "group_subjects",
    "grades",
    "recommendations",
  ]) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
  }
  assert.match(sql, /app_private\.can_access_group/i);
  assert.match(sql, /grades_enrollment_group_fk/i);
  assert.match(sql, /grades_subject_group_fk/i);
  assert.match(sql, /score smallint check \(score between 0 and 20\)/i);
  assert.match(sql, /char_length\(text\) <= 300/i);
});

test("el autoguardado versiona celdas y no confunde vacío con cero", async () => {
  const gradebook = await readFile(
    new URL("src/features/academic/Gradebook.tsx", root),
    "utf8",
  );

  assert.match(gradebook, /versions\.current/);
  assert.match(gradebook, /versions\.current\.isCurrent\(key, job\.version\)/);
  assert.match(gradebook, /parsed\.data === "" \? null : parsed\.data/);
  assert.match(gradebook, /onConflict: "enrollment_id,group_subject_id,term"/);
});

test("las notas pueden registrarse por asignatura o por alumno", async () => {
  const gradebook = await readFile(
    new URL("src/features/academic/Gradebook.tsx", root),
    "utf8",
  );

  assert.match(gradebook, /"por-asignatura" \| "por-alumno"/);
  assert.match(gradebook, /Por asignatura/);
  assert.match(gradebook, /Por alumno/);
  assert.match(gradebook, /orderedSubjects\.map/);
  assert.match(
    gradebook,
    /changeGrade\(\s*event,\s*selectedEnrollment\.id,\s*subject\.id,/,
  );
});

test("las recomendaciones generan un borrador editable sin sobrescribirlo automáticamente", async () => {
  const recommendations = await readFile(
    new URL("src/features/academic/Recommendations.tsx", root),
    "utf8",
  );

  assert.match(recommendations, /calculateTermAverage/);
  assert.match(recommendations, /denseRanks/);
  assert.match(recommendations, /generateRecommendation/);
  assert.match(recommendations, /Usar esta sugerencia/);
  assert.match(recommendations, /confirmReplace/);
  assert.match(recommendations, /Reemplazar texto/);
  assert.match(recommendations, /maxLength=\{300\}/);
});
