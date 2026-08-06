import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { buildMeritRanking } from "../src/domain/academic/merit-ranking.ts";

const root = new URL("../", import.meta.url);

const areas = [
  { active: true, id: "a1", includedInFinal: true },
  { active: true, id: "a2", includedInFinal: false },
];
const subjects = [
  { active: true, areaId: "a1", id: "s1" },
  { active: true, areaId: "a1", id: "s2" },
  { active: true, areaId: "a2", id: "s3" },
];
const enrollments = [
  {
    firstNames: "Ana",
    id: "e1",
    lastNames: "Pérez",
    status: "activo",
    withdrawnFromTerm: null,
  },
  {
    firstNames: "Bruno",
    id: "e2",
    lastNames: "Quispe",
    status: "activo",
    withdrawnFromTerm: null,
  },
  {
    firstNames: "Carla",
    id: "e3",
    lastNames: "Rojas",
    status: "activo",
    withdrawnFromTerm: null,
  },
];

test("el orden bimestral comparte puesto y señala registros provisionales", () => {
  const ranking = buildMeritRanking(1, enrollments, areas, subjects, [
    { enrollmentId: "e1", score: 20, subjectId: "s1", term: 1 },
    { enrollmentId: "e1", score: 16, subjectId: "s2", term: 1 },
    { enrollmentId: "e1", score: 5, subjectId: "s3", term: 1 },
    { enrollmentId: "e2", score: 18, subjectId: "s1", term: 1 },
  ]);

  assert.equal(ranking.expectedGrades, 2);
  assert.equal(ranking.rankedStudents, 2);
  assert.equal(ranking.completeStudents, 1);
  assert.deepEqual(
    ranking.entries.map((entry) => ({
      complete: entry.complete,
      id: entry.id,
      rank: entry.rank,
    })),
    [
      { complete: true, id: "e1", rank: 1 },
      { complete: false, id: "e2", rank: 1 },
      { complete: false, id: "e3", rank: null },
    ],
  );
  assert.equal(ranking.entries[0].average, 18);
});

test("un alumno retirado queda fuera de bimestres posteriores", () => {
  const withRetired = [
    ...enrollments,
    {
      firstNames: "Diego",
      id: "e4",
      lastNames: "Torres",
      status: "retirado",
      withdrawnFromTerm: 1,
    },
  ];
  const firstTerm = buildMeritRanking(1, withRetired, areas, subjects, []);
  const secondTerm = buildMeritRanking(2, withRetired, areas, subjects, []);

  assert.equal(firstTerm.entries.some((entry) => entry.id === "e4"), true);
  assert.equal(secondTerm.entries.some((entry) => entry.id === "e4"), false);
  assert.equal(secondTerm.excludedStudents, 1);
});

test("la pantalla de mérito tiene ruta y navegación propias", async () => {
  const required = [
    "src/app/(dashboard)/grupos/[groupId]/merito/page.tsx",
    "src/features/academic/MeritRanking.tsx",
    "src/domain/academic/merit-ranking.ts",
  ];
  await Promise.all(required.map((file) => access(new URL(file, root))));

  const workspace = await readFile(
    new URL("src/features/groups/GroupWorkspace.tsx", root),
    "utf8",
  );
  const component = await readFile(
    new URL("src/features/academic/MeritRanking.tsx", root),
    "utf8",
  );
  assert.match(workspace, /\/merito/);
  assert.match(component, /Orden de mérito/);
  assert.match(component, /ranking denso/);
  assert.match(component, /Faltan \{entry\.missingGrades\}/);
});
