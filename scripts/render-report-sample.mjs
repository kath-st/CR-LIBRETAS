import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildReportHtml } from "../src/features/reports/report-template.ts";
import { generatePdfFromHtml } from "../src/lib/pdf/chromium.ts";

const root = process.cwd();
await Promise.all(
  ["escudo.png", "firma-directora.png", "sello-institucional.png"].map(
    (fileName) =>
    copyFile(
      path.join(root, "docs", "referencias-boleta", fileName),
      path.join(root, "public", "brand", fileName),
    ),
  ),
);

const dataImage = async (fileName) =>
  `data:image/png;base64,${(
    await readFile(path.join(root, "public", "brand", fileName))
  ).toString("base64")}`;

const assets = {
  border: await dataImage("borde-de-la-libreta.png"),
  crest: await dataImage("escudo.png"),
  directorSignature: await dataImage("firma-directora.png"),
  seal: await dataImage("sello-institucional.png"),
  watermark: await dataImage("escudo-transparente-de-fondo.png"),
};

const definitions = [
  ["Matemática", ["Aritmética", "Álgebra", "Geometría", "Raz. Matemático"]],
  [
    "Comunicación Integral",
    ["Gramática", "Ortografía", "Comp. Lectora", "Raz. Verbal"],
  ],
  ["Ciencia y Tecnología", ["Biología", "Física", "Química"]],
  ["Personal Social", ["Historia", "Geografía"]],
  ["Educación Física", ["Educación Física"]],
  ["Educación por el Arte", ["Educación por el Arte"]],
  ["Educación Religiosa", ["Educación Religiosa"]],
  ["Inglés", ["Inglés"]],
  ["Computación", ["Computación"]],
  ["Conducta", ["Conducta"]],
];

const areas = definitions.map(([areaName, subjectNames], areaIndex) => ({
  average: 13 + (areaIndex % 5),
  id: `area-${areaIndex}`,
  isDirect: subjectNames.length === 1,
  name: areaName,
  subjects: subjectNames.map((name, subjectIndex) => ({
    average: 13 + ((areaIndex + subjectIndex) % 5),
    grades: [11, 13, 15, 17],
    id: `subject-${areaIndex}-${subjectIndex}`,
    name,
  })),
}));

const countArgument = process.argv.find((value) => value.startsWith("--count="));
const count = Math.min(
  30,
  Math.max(1, Number(countArgument?.split("=")[1] ?? 1)),
);
const snapshot = {
  cards: Array.from({ length: count }, (_, index) => ({
      areas,
      enrollmentId: `sample-enrollment-${index + 1}`,
      finalAverage: 15.4,
      recommendation:
        "Valery demuestra interés y responsabilidad. Debe reforzar la práctica diaria, revisar sus actividades y mantener su participación respetuosa en clase.",
      studentId: `sample-student-${index + 1}`,
      studentName:
        index === 0
          ? "ARQUINIGO QUISPE VALERY BEATRIZ"
          : `APELLIDOS DE PRUEBA ALUMNA ${index + 1}`,
      termRanks: [2, 1, 2, 1],
    })),
  generatedAt: new Date().toISOString(),
  group: {
    academicYear: 2026,
    grade: 5,
    id: "sample-group",
    level: "secundaria",
    section: "Única",
    teacherName: "LESLIE TORRES",
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

const pdf = await generatePdfFromHtml(buildReportHtml(snapshot, assets));
const outputDirectory = path.join(root, "output", "pdf");
const outputPath = path.join(
  outputDirectory,
  count === 1
    ? "fase-4-boleta-muestra.pdf"
    : `fase-4-boleta-${count}-alumnos.pdf`,
);
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, pdf);
console.log(outputPath);
