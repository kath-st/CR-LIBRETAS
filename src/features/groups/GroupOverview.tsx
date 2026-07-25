"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import styles from "@/features/academic/Academic.module.css";
import { useGroupWorkspace } from "./GroupWorkspace";

type Summary = {
  activeStudents: number;
  configuredSubjects: number;
  recordedGrades: number;
};

export function GroupOverview() {
  const group = useGroupWorkspace();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      const supabase = createClient();
      const [students, subjects, grades] = await Promise.all([
        supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("status", "activo"),
        supabase
          .from("group_subjects")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("active", true),
        supabase
          .from("grades")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id)
          .not("score", "is", null),
      ]);

      if (!active) return;
      const queryError = students.error ?? subjects.error ?? grades.error;
      if (queryError) {
        setError(queryError.message);
        return;
      }
      setSummary({
        activeStudents: students.count ?? 0,
        configuredSubjects: subjects.count ?? 0,
        recordedGrades: grades.count ?? 0,
      });
    }

    void loadSummary();
    return () => {
      active = false;
    };
  }, [group.id]);

  const base = `/grupos/${group.id}`;
  return (
    <section className={styles.page}>
      <header className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Flujo académico</p>
          <h2>Resumen del grupo</h2>
          <p>Completa cada módulo para mantener la libreta al día.</p>
        </div>
      </header>

      {error ? (
        <Alert title="No se pudo cargar el resumen" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : !summary ? (
        <Spinner label="Cargando resumen académico" />
      ) : (
        <div className={styles.stats}>
          <article className={styles.stat}>
            <span>Alumnos activos</span>
            <strong>{summary.activeStudents}</strong>
          </article>
          <article className={styles.stat}>
            <span>Asignaturas activas</span>
            <strong>{summary.configuredSubjects}</strong>
          </article>
          <article className={styles.stat}>
            <span>Notas registradas</span>
            <strong>{summary.recordedGrades}</strong>
          </article>
        </div>
      )}

      <div className={styles.shortcutGrid}>
        <Link className={styles.shortcut} href={`${base}/alumnos`}>
          <strong>1. Registrar alumnos</strong>
          <span>Crea matrículas y controla alumnos activos o retirados.</span>
        </Link>
        <Link className={styles.shortcut} href={`${base}/malla`}>
          <strong>2. Configurar malla</strong>
          <span>Activa áreas y asignaturas que corresponden al grupo.</span>
        </Link>
        <Link className={styles.shortcut} href={`${base}/notas`}>
          <strong>3. Ingresar notas</strong>
          <span>Registra los cuatro bimestres y revisa los promedios.</span>
        </Link>
        <Link className={styles.shortcut} href={`${base}/recomendaciones`}>
          <strong>4. Recomendaciones</strong>
          <span>Guarda la observación de tutoría por alumno y bimestre.</span>
        </Link>
        <Link className={styles.shortcut} href={`${base}/boletas`}>
          <strong>5. Generar boletas</strong>
          <span>Previsualiza, descarga y conserva los PDFs del grupo.</span>
        </Link>
        <Link className={styles.shortcut} href={`${base}/respaldos`}>
          <strong>6. Proteger y restaurar</strong>
          <span>Exporta JSON y recupera el grupo con validación integral.</span>
        </Link>
      </div>
    </section>
  );
}
