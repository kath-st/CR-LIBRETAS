import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Boleta estática A4",
};

type Subject = {
  grades: [number, number, number, number];
  name: string;
  p: number;
};

type Area = {
  global: number;
  name: string;
  subjects: Subject[];
};

const areas: Area[] = [
  {
    name: "MATEMÁTICA",
    global: 16,
    subjects: [
      { name: "ARITMÉTICA", grades: [15, 16, 17, 18], p: 17 },
      { name: "ÁLGEBRA", grades: [14, 16, 17, 17], p: 16 },
      { name: "GEOMETRÍA", grades: [15, 15, 16, 18], p: 16 },
      { name: "RAZ. MATEMÁTICO", grades: [14, 16, 18, 18], p: 17 },
    ],
  },
  {
    name: "COMUNICACIÓN INTEGRAL",
    global: 17,
    subjects: [
      { name: "GRAMÁTICA", grades: [16, 17, 18, 18], p: 17 },
      { name: "ORTOGRAFÍA", grades: [15, 17, 17, 18], p: 17 },
      { name: "COMP. LECTORA", grades: [16, 18, 18, 19], p: 18 },
      { name: "RAZ. VERBAL", grades: [15, 17, 18, 18], p: 17 },
    ],
  },
  {
    name: "CIENCIA Y TECNOLOGÍA",
    global: 16,
    subjects: [
      { name: "BIOLOGÍA", grades: [15, 16, 17, 17], p: 16 },
      { name: "FÍSICA", grades: [14, 16, 16, 18], p: 16 },
      { name: "QUÍMICA", grades: [15, 15, 17, 18], p: 16 },
    ],
  },
  {
    name: "PERSONAL SOCIAL",
    global: 17,
    subjects: [
      { name: "HISTORIA", grades: [16, 17, 18, 18], p: 17 },
      { name: "GEOGRAFÍA", grades: [15, 17, 17, 18], p: 17 },
    ],
  },
  {
    name: "EDUCACIÓN FÍSICA",
    global: 18,
    subjects: [{ name: "EDUCACIÓN FÍSICA", grades: [18, 18, 18, 19], p: 18 }],
  },
  {
    name: "EDUCACIÓN POR EL ARTE",
    global: 17,
    subjects: [{ name: "EDUCACIÓN POR EL ARTE", grades: [17, 17, 18, 18], p: 18 }],
  },
  {
    name: "EDUCACIÓN RELIGIOSA",
    global: 18,
    subjects: [{ name: "EDUCACIÓN RELIGIOSA", grades: [18, 18, 19, 19], p: 19 }],
  },
  {
    name: "INGLÉS",
    global: 16,
    subjects: [{ name: "INGLÉS", grades: [15, 16, 17, 17], p: 16 }],
  },
  {
    name: "COMPUTACIÓN",
    global: 18,
    subjects: [{ name: "COMPUTACIÓN", grades: [17, 18, 18, 19], p: 18 }],
  },
  {
    name: "CONDUCTA",
    global: 18,
    subjects: [{ name: "CONDUCTA", grades: [18, 18, 18, 18], p: 18 }],
  },
];

export default function ReportCardPreviewPage() {
  return (
    <main className={styles.screen}>
      <nav className={styles.toolbar} aria-label="Acciones de la prueba A4">
        <div>
          <strong>Validación de Fase 0</strong>
          <span>Datos ficticios · contenido máximo</span>
        </div>
        <Link href="/login">Volver al sistema</Link>
      </nav>

      <article className={styles.sheet} aria-label="Boleta de notas de prueba">
        <div className={styles.orangeFrame} aria-hidden="true" />
        <img
          alt=""
          aria-hidden="true"
          className={styles.watermark}
          src="/brand/escudo-transparente-de-fondo.png"
        />

        <header className={styles.header}>
          <img
            alt="Escudo de la I.E.P. Cristo Redentor"
            className={styles.crest}
            src="/brand/escudo.png"
          />
          <div>
            <p>Institución Educativa Privada</p>
            <h1>“CRISTO REDENTOR DE NOCHETO”</h1>
            <h2>EDUCACIÓN PRIMARIA</h2>
            <h3>DIOS, AMOR, DISCIPLINA</h3>
            <small>MZ J – LT 8 PSJ RASUÑITI SANTA ANITA</small>
          </div>
        </header>

        <p className={styles.officialYear}>
          “AÑO DE LA RECUPERACIÓN Y CONSOLIDACIÓN DE LA ECONOMÍA PERUANA”
        </p>
        <h2 className={styles.reportTitle}>BOLETA DE NOTAS 2026</h2>

        <table className={styles.studentTable}>
          <tbody>
            <tr>
              <th>GRADO</th>
              <td>SEXTO</td>
              <th>NIVEL</th>
              <td>PRIMARIA</td>
            </tr>
            <tr>
              <th>APELLIDOS Y NOMBRES</th>
              <td colSpan={3}>ARQUINIGO QUISPE VALERY BEATRIZ</td>
            </tr>
          </tbody>
        </table>

        <table className={styles.gradesTable}>
          <thead>
            <tr>
              <th rowSpan={2}>ÁREA</th>
              <th rowSpan={2}>ASIGNATURA</th>
              <th colSpan={5}>PROMEDIOS BIMESTRALES</th>
              <th rowSpan={2}>PROM. GLOBAL</th>
            </tr>
            <tr>
              <th>1B</th>
              <th>2B</th>
              <th>3B</th>
              <th>4B</th>
              <th>P</th>
            </tr>
          </thead>
          <tbody>
            {areas.flatMap((area) =>
              area.subjects.map((subject, index) => (
                <tr key={`${area.name}-${subject.name}`}>
                  {index === 0 ? (
                    <th className={styles.area} rowSpan={area.subjects.length}>
                      {area.name}
                    </th>
                  ) : null}
                  <td className={styles.subject}>{subject.name}</td>
                  {subject.grades.map((grade, gradeIndex) => (
                    <td key={gradeIndex}>{grade}</td>
                  ))}
                  <td>{subject.p}</td>
                  {index === 0 ? (
                    <td className={styles.global} rowSpan={area.subjects.length}>
                      {area.global}
                    </td>
                  ) : null}
                </tr>
              )),
            )}
          </tbody>
        </table>

        <section className={styles.summary}>
          <div className={styles.recommendation}>
            <h3>RECOMENDACIONES DE LA TUTORA</h3>
            <p>
              Valery demuestra responsabilidad, entusiasmo y constancia. Se
              recomienda mantener el hábito diario de lectura, revisar las
              operaciones antes de entregar cada actividad y continuar
              participando con respeto y seguridad en clase.
            </p>
          </div>
          <div className={styles.signature}>
            <strong>ELIZABETH CALZADA B.</strong>
            <span>FIRMA DE LA TUTORA</span>
          </div>
          <div className={styles.seal}>
            <img alt="Sello institucional" src="/brand/sello-institucional.png" />
          </div>
          <div className={styles.final}>
            <span>PROMEDIO FINAL</span>
            <strong>16.9</strong>
            <span>ORDEN DE MÉRITO</span>
            <strong>2</strong>
          </div>
        </section>
      </article>
    </main>
  );
}
