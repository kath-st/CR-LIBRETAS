import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { buildReportHtml } from "../src/features/reports/report-template.ts";

const root = new URL("../", import.meta.url);
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA" +
  "CklEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const assets = {
  border: pixel,
  crest: pixel,
  directorSignature: pixel,
  seal: pixel,
  watermark: pixel,
};

function card(index, subjectCount = 19) {
  return {
    areas: [
      {
        average: 15,
        id: "area-1",
        isDirect: false,
        name: "Matemática",
        subjects: Array.from({ length: subjectCount }, (_, subjectIndex) => ({
          average: 15,
          grades: [14, 15, 16, 15],
          id: `subject-${subjectIndex}`,
          name: `Asignatura ${subjectIndex + 1}`,
        })),
      },
    ],
    enrollmentId: `enrollment-${index}`,
    finalAverage: 15,
    recommendation: "Continúa trabajando con responsabilidad.",
    studentId: `student-${index}`,
    studentName: `APELLIDOS, ALUMNO ${index}`,
    termRanks: [1, 1, 1, 1],
  };
}

function snapshot(cards) {
  return {
    cards,
    generatedAt: "2026-07-23T00:00:00.000Z",
    group: {
      academicYear: 2026,
      grade: 6,
      id: "group-1",
      level: "primaria",
      section: "Única",
      teacherName: "DOCENTE RESPONSABLE",
    },
    institution: {
      address: "MZ J - LT 8 PSJ RASUÑITI SANTA ANITA",
      motto: "DIOS, AMOR, DISCIPLINA",
      name: "I.E.P. CRISTO REDENTOR DE NOCHETO",
      officialYearName:
        "AÑO DE LA RECUPERACIÓN Y CONSOLIDACIÓN DE LA ECONOMÍA PERUANA",
    },
    version: 1,
  };
}

test("la Fase 4 incluye rutas, plantilla, migración y motor PDF", async () => {
  const required = [
    "src/app/(dashboard)/grupos/[groupId]/boletas/page.tsx",
    "src/app/api/groups/[groupId]/report-cards/route.ts",
    "src/app/api/groups/[groupId]/report-cards/preview/route.ts",
    "src/app/api/groups/[groupId]/report-cards/[generationId]/route.ts",
    "src/features/reports/ReportCards.tsx",
    "src/features/reports/report-template.ts",
    "src/lib/pdf/chromium.ts",
    "supabase/migrations/20260723000400_phase_4_report_cards.sql",
    "supabase/migrations/20260723000500_seed_institution_settings.sql",
    "supabase/tests/database/004_phase_4_report_cards.test.sql",
  ];
  await Promise.all(required.map((file) => access(new URL(file, root))));
});

test("la configuración institucional requerida se migra sin sobrescribirla", async () => {
  const sql = await readFile(
    new URL(
      "supabase/migrations/20260723000500_seed_institution_settings.sql",
      root,
    ),
    "utf8",
  );
  assert.match(sql, /insert into public\.institution_settings/i);
  assert.match(sql, /I\.E\.P\. Cristo Redentor de Nocheto/i);
  assert.match(sql, /on conflict \(id\) do nothing/i);
});

test("la plantilla genera una hoja A4 por cada uno de 30 alumnos", () => {
  const html = buildReportHtml(
    snapshot(Array.from({ length: 30 }, (_, index) => card(index + 1))),
    assets,
  );
  assert.equal((html.match(/<article class="report-sheet/g) ?? []).length, 30);
  assert.match(html, /@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*0;/);
  assert.match(html, /page-break-after:\s*always/);
});

test("la plantilla incluye los recursos gráficos una sola vez por lote", () => {
  const uniqueAssets = {
    border: "data:image/png;base64,BORDER",
    crest: "data:image/png;base64,CREST",
    directorSignature: "data:image/png;base64,SIGNATURE",
    seal: "data:image/png;base64,SEAL",
    watermark: "data:image/png;base64,WATERMARK",
  };
  const html = buildReportHtml(
    snapshot(Array.from({ length: 30 }, (_, index) => card(index + 1))),
    uniqueAssets,
  );

  for (const asset of Object.values(uniqueAssets)) {
    assert.equal(html.split(asset).length - 1, 1);
  }
  assert.equal(
    (html.match(/data-report-asset="crest"/g) ?? []).length,
    30,
  );
  assert.ok(Buffer.byteLength(html) < 250_000);
});

test("la plantilla adapta filas y no inventa asignaturas retiradas", () => {
  const html = buildReportHtml(snapshot([card(1, 7)]), assets);
  assert.match(html, /style="--row-count:7"/);
  assert.match(html, /Asignatura 7/);
  assert.doesNotMatch(html, /Asignatura 8/);
});

test("la libreta conserva tipografía legible según la cantidad de filas", () => {
  const regular = buildReportHtml(snapshot([card(1, 19)]), assets);
  const compact = buildReportHtml(snapshot([card(1, 20)]), assets);
  const tight = buildReportHtml(snapshot([card(1, 25)]), assets);

  assert.match(regular, /\.student-table \{[^}]*font-size: 9pt;/);
  assert.match(regular, /\.grades-table \{ font-size: 8pt;/);
  assert.match(compact, /class="report-sheet density-compact"/);
  assert.match(tight, /class="report-sheet density-tight"/);
  assert.match(tight, /\.density-tight \.grades-table \{ font-size: 7\.2pt; \}/);
});

test("la plantilla incluye la firma de la directora y encierra el mérito", () => {
  const html = buildReportHtml(snapshot([card(1)]), assets);
  assert.match(html, /alt="Firma de la directora"/);
  assert.match(html, /\.final > span:nth-of-type\(2\) \{ border-top:/);
});

test("la migración conserva PDFs privados e inmutables", async () => {
  const sql = await readFile(
    new URL(
      "supabase/migrations/20260723000400_phase_4_report_cards.sql",
      root,
    ),
    "utf8",
  );
  assert.match(sql, /report_card_generations_are_immutable/i);
  assert.match(sql, /stored_report_cards_are_immutable/i);
  assert.match(sql, /'report-cards',\s*'report-cards',\s*false/i);
  assert.match(sql, /app_private\.can_access_group\(group_id\)/i);
  assert.match(sql, /snapshot jsonb not null/i);
});
