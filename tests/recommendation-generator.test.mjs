import assert from "node:assert/strict";
import test from "node:test";
import {
  generateRecommendation,
  recommendationBand,
} from "../src/domain/academic/recommendation-generator.ts";

test("clasifica correctamente los límites académicos", () => {
  assert.equal(recommendationBand(10), "refuerzo");
  assert.equal(recommendationBand(11), "proceso");
  assert.equal(recommendationBand(14.99), "proceso");
  assert.equal(recommendationBand(15), "bueno");
  assert.equal(recommendationBand(17.99), "bueno");
  assert.equal(recommendationBand(18), "excelente");
  assert.equal(recommendationBand(20), "excelente");
});

test("genera una felicitación especial para promedio excelente y primer puesto", () => {
  const text = generateRecommendation({
    firstName: "ASHLEY",
    observationIds: ["responsable"],
    rank: 1,
    termAverage: 19,
    variantSeed: "ashley:1:0",
  });

  assert.match(text, /^Ashley,/);
  assert.match(text, /excelente/i);
  assert.match(text, /primer puesto/i);
  assert.match(text, /responsabilidad/i);
  assert.ok(text.length <= 300);
});

test("solo incorpora conductas seleccionadas por la docente", () => {
  const text = generateRecommendation({
    firstName: "Gabriel",
    observationIds: ["distraccion", "practica"],
    rank: 8,
    termAverage: 12,
    variantSeed: "gabriel:1:0",
  });

  assert.match(text, /evita distraerte/i);
  assert.match(text, /practica con mayor constancia/i);
  assert.doesNotMatch(text, /acompañamiento en casa/i);
  assert.ok(text.length <= 300);
});

test("la variante es determinista y admite hasta tres observaciones", () => {
  const input = {
    firstName: "Delia María",
    observationIds: ["interes", "tareas_pendientes", "apoyo_casa"],
    rank: 5,
    termAverage: 13.5,
    variantSeed: "delia:2:4",
  };

  const text = generateRecommendation(input);
  assert.equal(text, generateRecommendation(input));
  assert.match(text, /interés/i);
  assert.match(text, /tareas/i);
  assert.match(text, /refuerza en casa/i);
  assert.ok(text.length <= 300);
});

test("rechaza promedios y cantidades de observaciones inválidos", () => {
  assert.throws(
    () =>
      generateRecommendation({
        firstName: "Gia",
        observationIds: [],
        rank: null,
        termAverage: 21,
        variantSeed: "gia",
      }),
    /promedio debe estar entre 0 y 20/i,
  );

  assert.throws(
    () =>
      generateRecommendation({
        firstName: "Gia",
        observationIds: [
          "interes",
          "practica",
          "participacion",
          "responsabilidad",
        ],
        rank: null,
        termAverage: 12,
        variantSeed: "gia",
      }),
    /máximo tres/i,
  );
});
