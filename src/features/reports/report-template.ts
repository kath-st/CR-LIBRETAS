import type {
  ReportArea,
  ReportAssets,
  ReportBatchSnapshot,
  ReportCard,
} from "./types";

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayScore(value: number | null, decimals = 0) {
  if (value === null) return "";
  return decimals ? value.toFixed(decimals) : String(Math.round(value));
}

function levelLabel(level: ReportBatchSnapshot["group"]["level"]) {
  const labels = {
    inicial: "Educación inicial",
    primaria: "Educación primaria",
    secundaria: "Educación secundaria",
  };
  return labels[level];
}

function gradeLabel(
  level: ReportBatchSnapshot["group"]["level"],
  grade: number,
) {
  if (level === "inicial") return `${grade} años`;
  const labels = ["", "Primero", "Segundo", "Tercero", "Cuarto", "Quinto", "Sexto"];
  return labels[grade] ?? `${grade}.º`;
}

function directArea(area: ReportArea) {
  return (
    area.isDirect &&
    area.subjects.length === 1 &&
    area.subjects[0]?.name.localeCompare(area.name, "es", {
      sensitivity: "base",
    }) === 0
  );
}

function renderArea(area: ReportArea) {
  return area.subjects
    .map((subject, index) => {
      const areaCell =
        index === 0
          ? directArea(area)
            ? `<th class="area direct" colspan="2">${escapeHtml(area.name)}</th>`
            : `<th class="area" rowspan="${area.subjects.length}">${escapeHtml(area.name)}</th>`
          : "";
      const subjectCell = directArea(area)
        ? ""
        : `<td class="subject">${escapeHtml(subject.name)}</td>`;
      const grades = subject.grades
        .map((grade) => `<td>${displayScore(grade)}</td>`)
        .join("");
      const global =
        index === 0
          ? `<td class="global" rowspan="${area.subjects.length}">${displayScore(area.average)}</td>`
          : "";

      return `<tr>${areaCell}${subjectCell}${grades}<td>${displayScore(subject.average)}</td>${global}</tr>`;
    })
    .join("");
}

function renderCard(
  snapshot: ReportBatchSnapshot,
  card: ReportCard,
) {
  const rowCount = Math.max(
    1,
    card.areas.reduce((total, area) => total + area.subjects.length, 0),
  );
  const densityClass =
    rowCount > 24 ? "density-tight" : rowCount > 19 ? "density-compact" : "";
  const recommendation =
    card.recommendation ||
    "Sin recomendaciones registradas para los bimestres evaluados.";

  return `
    <article class="report-sheet ${densityClass}" style="--row-count:${rowCount}">
      <img alt="" class="orange-border" data-report-asset="border">
      <img alt="" class="watermark" data-report-asset="watermark">

      <div class="report-content">
        <header class="institution-header">
        <img alt="Escudo institucional" class="crest" data-report-asset="crest">
        <div>
          <p>Institución Educativa Privada</p>
          <h1>“${escapeHtml(snapshot.institution.name.replace(/^I\.?E\.?P\.?\s*/i, ""))}”</h1>
          <h2>${escapeHtml(levelLabel(snapshot.group.level))}</h2>
          <h3>${escapeHtml(snapshot.institution.motto)}</h3>
          <small>${escapeHtml(snapshot.institution.address)}</small>
        </div>
        </header>

        <p class="official-year">“${escapeHtml(snapshot.institution.officialYearName)}”</p>
        <h2 class="report-title">BOLETA DE NOTAS ${snapshot.group.academicYear}</h2>

        <table class="student-table">
        <tbody>
          <tr>
            <th>GRADO</th>
            <td>${escapeHtml(gradeLabel(snapshot.group.level, snapshot.group.grade))}</td>
            <th>NIVEL</th>
            <td>${escapeHtml(snapshot.group.level)}</td>
          </tr>
          <tr>
            <th>APELLIDOS Y NOMBRES</th>
            <td colspan="3">${escapeHtml(card.studentName)}</td>
          </tr>
        </tbody>
        </table>

        <table class="grades-table">
        <thead>
          <tr>
            <th rowspan="2">ÁREA</th>
            <th rowspan="2">ASIGNATURA</th>
            <th colspan="5">PROMEDIOS BIMESTRALES</th>
            <th rowspan="2">PROM. GLOBAL</th>
          </tr>
          <tr>
            <th>1B</th>
            <th>2B</th>
            <th>3B</th>
            <th>4B</th>
            <th>P</th>
          </tr>
        </thead>
        <tbody>${card.areas.map(renderArea).join("")}</tbody>
        </table>

        <section class="summary">
        <div class="recommendation">
          <h3>RECOMENDACIONES DE LA TUTORA</h3>
          <p>${escapeHtml(recommendation)}</p>
        </div>
        <div class="signature">
          <strong>${escapeHtml(snapshot.group.teacherName)}</strong>
          <span>FIRMA DE LA TUTORA</span>
        </div>
        <div class="seal">
          <img alt="Sello institucional" class="seal-image" data-report-asset="seal">
          <img alt="Firma de la directora" class="director-signature" data-report-asset="directorSignature">
        </div>
        <div class="final">
          <span>PROMEDIO FINAL</span>
          <strong>${displayScore(card.finalAverage, 1)}</strong>
          <span>ORDEN DE MÉRITO</span>
          <div class="merit">
            ${card.termRanks
              .map(
                (rank, index) =>
                  `<span><small>${index + 1}B</small><b>${rank ?? ""}</b></span>`,
              )
              .join("")}
          </div>
        </div>
        </section>
      </div>
    </article>
  `;
}

const REPORT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #e8ebef; }
  body { color: #050505; font-family: Georgia, "Times New Roman", serif; }
  .report-sheet {
    position: relative;
    isolation: isolate;
    width: 210mm;
    height: 297mm;
    margin: 0 auto 8mm;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 12mm 8mm 6mm;
    overflow: hidden;
    background: #fff;
    page-break-after: always;
    break-after: page;
  }
  .report-sheet:last-child { margin-bottom: 0; page-break-after: auto; break-after: auto; }
  .orange-border {
    position: absolute;
    z-index: -3;
    top: 1.5mm;
    left: -18%;
    width: 136%;
    height: calc(100% - 3mm);
    object-fit: fill;
    opacity: .68;
    pointer-events: none;
  }
  .watermark {
    position: absolute;
    z-index: -2;
    top: 52%;
    left: 50%;
    width: 132mm;
    height: 171mm;
    object-fit: contain;
    opacity: .5;
    transform: translate(-50%, -43%);
    pointer-events: none;
  }
  .report-content {
    width: 100%;
  }
  .institution-header {
    display: grid;
    grid-template-columns: 31mm 1fr 31mm;
    align-items: center;
    min-height: 47mm;
    margin: 0 2mm;
    text-align: center;
  }
  .institution-header .crest {
    width: 38mm;
    height: 45mm;
    object-fit: contain;
  }
  .institution-header div {
    grid-column: 2;
    transform: translateX(4mm);
  }
  .institution-header p,
  .institution-header h1,
  .institution-header h2,
  .institution-header h3 { margin: 0; text-transform: uppercase; }
  .institution-header p {
    font: 800 18.4pt Arial, sans-serif;
    line-height: 1.12;
    text-transform: none;
  }
  .institution-header h1 {
    font: 900 16.8pt Arial, sans-serif;
    letter-spacing: -.25pt;
    line-height: 1.13;
  }
  .institution-header h2 {
    margin-top: .8mm;
    font: 900 15.6pt Arial, sans-serif;
    line-height: 1.14;
  }
  .institution-header h3 {
    margin-top: .9mm;
    font-size: 13.4pt;
    line-height: 1.16;
  }
  .institution-header small {
    display: block;
    margin-top: 2.3mm;
    font-size: 8.4pt;
    font-weight: 800;
    text-transform: uppercase;
  }
  .official-year {
    margin: 2.2mm 0 1.7mm;
    font: 800 9pt Arial, sans-serif;
    text-align: center;
    text-transform: uppercase;
  }
  .report-title {
    margin: 0 0 2.2mm;
    font: 900 17pt Arial, sans-serif;
    text-align: center;
  }
  table { border-collapse: collapse; table-layout: fixed; }
  .student-table, .grades-table { width: 100%; }
  .student-table { margin-bottom: 3.8mm; font-size: 9pt; }
  .student-table th, .student-table td,
  .grades-table th, .grades-table td { border: .35mm solid #000; }
  .student-table th, .student-table td {
    height: 7mm;
    padding: .8mm 1.2mm;
    text-align: center;
    text-transform: uppercase;
  }
  .student-table th { width: 25%; background: rgba(220, 234, 247, .78); }
  .student-table td { font-family: Arial, sans-serif; font-weight: 800; }
  .grades-table { font-size: 8pt; line-height: 1.16; }
  .grades-table thead th {
    height: 5.1mm;
    padding: .45mm;
    color: #d01212;
    background: rgba(255, 255, 255, .82);
  }
  .grades-table th:first-child { width: 29mm; }
  .grades-table th:nth-child(2) { width: 35mm; }
  .grades-table th:last-child { width: 20mm; }
  .grades-table tbody tr {
    height: clamp(4.4mm, calc(135mm / var(--row-count)), 12mm);
  }
  .grades-table tbody td, .grades-table tbody th { padding: .32mm .75mm; }
  .grades-table tbody td:not(.subject) {
    font-family: Arial, sans-serif;
    font-size: 8pt;
    font-weight: 800;
    text-align: center;
  }
  .area {
    color: #0d3568;
    font-size: 7.8pt;
    line-height: 1.16;
    text-align: center;
    text-transform: uppercase;
  }
  .area.direct { text-align: left; padding-left: 2.5mm; }
  .subject {
    color: #633184;
    font-size: 7.5pt;
    font-weight: 800;
    text-transform: uppercase;
  }
  .global { background: rgba(255, 248, 238, .42); }
  .summary {
    display: grid;
    grid-template-columns: 2.45fr 1.5fr 1.48fr 1.05fr;
    min-height: 40mm;
    border: .35mm solid #000;
    border-top: 0;
  }
  .summary > div { min-width: 0; border-right: .35mm solid #000; }
  .summary > div:last-child { border-right: 0; }
  .recommendation {
    display: grid;
    grid-template-rows: 7.2mm 1fr;
    padding: 0;
  }
  .recommendation h3 {
    display: flex;
    align-items: center;
    margin: 0;
    padding: 1mm 2.5mm;
    border-bottom: .35mm solid #000;
    color: #633184;
    font-size: 7.6pt;
    text-align: left;
  }
  .recommendation p {
    margin: 0;
    padding: 2mm 2.5mm;
    font-size: 8pt;
    line-height: 1.32;
    text-align: center;
  }
  .signature {
    display: grid;
    grid-template-rows: 1fr 1fr;
    padding: 0;
    text-align: center;
  }
  .signature strong {
    display: grid;
    place-items: center;
    padding: 2mm 1.5mm;
    border-bottom: .35mm solid #000;
    font-size: 7.6pt;
    text-transform: uppercase;
  }
  .signature span {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 2mm 1mm 2.2mm;
    font-size: 7.3pt;
  }
  .signature span::before {
    position: absolute;
    top: 56%;
    left: 13%;
    width: 74%;
    border-top: .3mm solid #000;
    content: "";
  }
  .seal {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .seal img { display: block; object-fit: contain; mix-blend-mode: multiply; }
  .seal-image { width: 28mm; height: 28mm; }
  .director-signature {
    width: 35mm;
    height: 10mm;
    margin-top: -4.4mm;
  }
  .final { display: grid; grid-template-rows: auto 1fr auto 9mm; text-align: center; }
  .final > span {
    padding: .8mm .4mm;
    border-bottom: .3mm solid #000;
    font-size: 6.8pt;
    font-weight: 800;
  }
  .final > span:nth-of-type(2) { border-top: .3mm solid #000; }
  .final > strong { display: grid; place-items: center; font: 900 10pt Arial, sans-serif; }
  .merit { display: grid; grid-template-columns: repeat(4, 1fr); }
  .merit span { display: grid; grid-template-rows: 3mm 1fr; border-right: .3mm solid #000; }
  .merit span:last-child { border-right: 0; }
  .merit small { border-bottom: .3mm solid #000; font-size: 6pt; }
  .merit b { display: grid; place-items: center; font: 800 7.4pt Arial, sans-serif; }
  .density-compact .grades-table,
  .density-tight .grades-table { font-size: 7.2pt; }
  .density-compact .subject { font-size: 6.9pt; }
  .density-tight .subject { font-size: 6.5pt; }
  .density-tight .institution-header { min-height: 40mm; }
  .density-tight .official-year { margin-top: 1.5mm; }
  .density-tight .summary { min-height: 34mm; }
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body { background: #fff; }
    .report-sheet { margin: 0; box-shadow: none; }
  }
`;

function serializedAssets(assets: ReportAssets) {
  return JSON.stringify(assets)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function buildReportHtml(
  snapshot: ReportBatchSnapshot,
  assets: ReportAssets,
) {
  const title =
    snapshot.cards.length === 1
      ? `Boleta de ${snapshot.cards[0]?.studentName ?? "notas"}`
      : `Boletas de ${snapshot.group.academicYear}`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>${REPORT_CSS}</style>
  </head>
  <body>
    ${snapshot.cards.map((card) => renderCard(snapshot, card)).join("")}
    <script id="report-assets" type="application/json">${serializedAssets(assets)}</script>
    <script>
      (() => {
        const source = document.getElementById("report-assets");
        const assets = JSON.parse(source?.textContent || "{}");
        document.querySelectorAll("[data-report-asset]").forEach((image) => {
          const key = image.getAttribute("data-report-asset");
          const src = key ? assets[key] : null;
          if (typeof src === "string") image.src = src;
        });
      })();
    </script>
  </body>
</html>`;
}
