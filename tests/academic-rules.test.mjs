import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  averageAvailable,
  averageRecorded,
  calculateStudentResult,
  denseRanks,
  finalVisible,
  visibleInteger,
} from "../src/domain/academic/calculations.ts";

const cases = JSON.parse(
  await readFile(
    new URL("./fixtures/academic-calculation-cases.json", import.meta.url),
    "utf8",
  ),
);

test("los casos de promedio respetan NULL y cero", () => {
  for (const item of cases.subjectAverages) {
    const internal = averageRecorded(item.grades);
    assert.equal(internal, item.internal, item.name);
    assert.equal(visibleInteger(internal), item.visible, item.name);
  }
});

test("el área promedia los P visibles y el final los globales visibles", () => {
  const areas = [
    { active: true, id: "comunicacion", includedInFinal: true },
    { active: true, id: "otra", includedInFinal: true },
    { active: true, id: "excluida", includedInFinal: false },
  ];
  const subjects = [
    { active: true, areaId: "comunicacion", id: "lenguaje" },
    { active: true, areaId: "comunicacion", id: "literatura" },
    { active: true, areaId: "comunicacion", id: "verbal" },
    { active: true, areaId: "otra", id: "otra-asignatura" },
    { active: true, areaId: "excluida", id: "excluida-asignatura" },
  ];
  const grades = [
    { score: 13, subjectId: "lenguaje", term: 1 },
    { score: 14, subjectId: "lenguaje", term: 2 },
    { score: 13, subjectId: "literatura", term: 1 },
    { score: 13, subjectId: "literatura", term: 2 },
    { score: 13, subjectId: "verbal", term: 1 },
    { score: 14, subjectId: "verbal", term: 2 },
    { score: 11, subjectId: "otra-asignatura", term: 1 },
    { score: 12, subjectId: "otra-asignatura", term: 2 },
    { score: 20, subjectId: "excluida-asignatura", term: 1 },
  ];

  const result = calculateStudentResult(areas, subjects, grades);
  assert.deepEqual(
    ["lenguaje", "literatura", "verbal"].map((id) =>
      visibleInteger(result.subjectAverages[id]),
    ),
    [14, 13, 14],
  );
  assert.equal(result.areaAverages.comunicacion, 41 / 3);
  assert.equal(visibleInteger(result.areaAverages.comunicacion), 14);
  assert.equal(visibleInteger(result.areaAverages.otra), 12);
  assert.equal(result.finalInternal, 13);
  assert.equal(result.finalVisible, 13);
});

test("el promedio final conserva precisión antes de mostrar un decimal", () => {
  const internal = averageAvailable(cases.finalAverage.areaInternalValues);
  assert.equal(internal, cases.finalAverage.internal);
  assert.equal(finalVisible(internal), cases.finalAverage.visible);
});

test("los empates usan ranking denso", () => {
  const ranks = denseRanks(cases.denseRanking);
  for (const item of cases.denseRanking) {
    assert.equal(ranks[item.id], item.rank);
  }
});

test("rechaza notas fuera de 0 a 20 o no enteras", () => {
  assert.throws(() => averageRecorded([21]), RangeError);
  assert.throws(() => averageRecorded([14.5]), RangeError);
});
