import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  averageAvailable,
  averageRecorded,
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
