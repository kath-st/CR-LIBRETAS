"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Spinner } from "@/components/ui";
import {
  buildMeritRanking,
  type MeritEnrollment,
} from "@/domain/academic/merit-ranking";
import type {
  AcademicArea,
  AcademicSubject,
  StudentGrade,
} from "@/domain/academic/calculations";
import { useGroupWorkspace } from "@/features/groups/GroupWorkspace";
import { createClient } from "@/lib/supabase/client";
import styles from "./Academic.module.css";

type EnrollmentRow = {
  id: string;
  status: "activo" | "retirado";
  students: { first_names: string; last_names: string };
  withdrawn_from_term: number | null;
};

type AreaRow = {
  active: boolean;
  id: string;
  included_in_final: boolean;
};

type SubjectRow = {
  active: boolean;
  group_area_id: string;
  id: string;
};

type GradeRow = {
  enrollment_id: string;
  group_subject_id: string;
  score: number | null;
  term: 1 | 2 | 3 | 4;
};

const TERMS = [1, 2, 3, 4] as const;

function averageLabel(value: number | null) {
  return value === null ? "—" : value.toFixed(1);
}

export function MeritRanking() {
  const group = useGroupWorkspace();
  const [term, setTerm] = useState<1 | 2 | 3 | 4>(1);
  const [enrollments, setEnrollments] = useState<MeritEnrollment[]>([]);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [grades, setGrades] = useState<
    Array<StudentGrade & { enrollmentId: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  const loadRanking = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const [enrollmentResult, areaResult, subjectResult, gradeResult] =
      await Promise.all([
        supabase
          .from("enrollments")
          .select(
            "id, status, withdrawn_from_term, students!inner(first_names, last_names)",
          )
          .eq("group_id", group.id),
        supabase
          .from("group_areas")
          .select("id, active, included_in_final")
          .eq("group_id", group.id)
          .eq("active", true),
        supabase
          .from("group_subjects")
          .select("id, group_area_id, active")
          .eq("group_id", group.id)
          .eq("active", true),
        supabase
          .from("grades")
          .select("enrollment_id, group_subject_id, term, score")
          .eq("group_id", group.id)
          .eq("term", term),
      ]);
    const queryError =
      enrollmentResult.error ??
      areaResult.error ??
      subjectResult.error ??
      gradeResult.error;
    if (queryError) throw new Error(queryError.message);
    if (version !== requestVersion.current) return;

    setEnrollments(
      ((enrollmentResult.data ?? []) as unknown as EnrollmentRow[]).map(
        (enrollment) => ({
          firstNames: enrollment.students.first_names,
          id: enrollment.id,
          lastNames: enrollment.students.last_names,
          status: enrollment.status,
          withdrawnFromTerm: enrollment.withdrawn_from_term,
        }),
      ),
    );
    setAreas(
      ((areaResult.data ?? []) as AreaRow[]).map((area) => ({
        active: area.active,
        id: area.id,
        includedInFinal: area.included_in_final,
      })),
    );
    setSubjects(
      ((subjectResult.data ?? []) as SubjectRow[]).map((subject) => ({
        active: subject.active,
        areaId: subject.group_area_id,
        id: subject.id,
      })),
    );
    setGrades(
      ((gradeResult.data ?? []) as GradeRow[]).map((grade) => ({
        enrollmentId: grade.enrollment_id,
        score: grade.score,
        subjectId: grade.group_subject_id,
        term: grade.term,
      })),
    );
  }, [group.id, term]);

  useEffect(() => {
    let active = true;
    loadRanking()
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo calcular el orden de mérito.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      requestVersion.current += 1;
    };
  }, [loadRanking]);

  const ranking = useMemo(
    () => buildMeritRanking(term, enrollments, areas, subjects, grades),
    [areas, enrollments, grades, subjects, term],
  );
  const bestAverage =
    ranking.entries.find((entry) => entry.averageVisible !== null)
      ?.averageVisible ?? null;
  const provisionalStudents = ranking.entries.filter(
    (entry) => entry.rank !== null && !entry.complete,
  ).length;

  return (
    <section className={styles.page}>
      <header className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Resultados del grupo</p>
          <h2>Orden de mérito</h2>
          <p>
            Compara el promedio interno de cada alumno usando únicamente las
            notas del bimestre seleccionado.
          </p>
        </div>
        <label className={`${styles.field} ${styles.meritTermField}`}>
          Bimestre
          <select
            disabled={loading}
            onChange={(event) =>
              setTerm(Number(event.target.value) as 1 | 2 | 3 | 4)
            }
            value={term}
          >
            {TERMS.map((item) => (
              <option key={item} value={item}>
                {item}.° bimestre
              </option>
            ))}
          </select>
        </label>
      </header>

      {error ? (
        <Alert title="No se pudo abrir el orden de mérito" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      {loading ? (
        <Spinner label={`Calculando mérito del ${term}.° bimestre`} />
      ) : !ranking.expectedGrades ? (
        <p className={styles.empty}>
          Activa al menos una asignatura dentro de un área que participe en el
          promedio final.
        </p>
      ) : !ranking.entries.length ? (
        <p className={styles.empty}>
          No hay alumnos que participen en este bimestre.
        </p>
      ) : (
        <>
          <div className={styles.meritSnapshot}>
            <div>
              <span>Alumnos con promedio</span>
              <strong>{ranking.rankedStudents}</strong>
            </div>
            <div>
              <span>Promedio más alto</span>
              <strong>{averageLabel(bestAverage)}</strong>
            </div>
            <div>
              <span>Registros completos</span>
              <strong>
                {ranking.completeStudents}/{ranking.entries.length}
              </strong>
            </div>
            <div>
              <span>Notas esperadas por alumno</span>
              <strong>{ranking.expectedGrades}</strong>
            </div>
          </div>

          {provisionalStudents ? (
            <p className={styles.warning}>
              {provisionalStudents} alumno(s) tienen un puesto provisional porque
              aún les faltan notas del bimestre. El ranking cambiará
              automáticamente al completar el registro.
            </p>
          ) : null}

          <div className={styles.tableWrap}>
            <table className={`${styles.gradeTable} ${styles.meritTable}`}>
              <thead>
                <tr>
                  <th>Puesto</th>
                  <th>Alumno</th>
                  <th>Promedio</th>
                  <th>Notas registradas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ranking.entries.map((entry) => (
                  <tr
                    className={entry.rank === 1 ? styles.meritFirstPlace : ""}
                    key={entry.id}
                  >
                    <td>
                      {entry.rank === null ? (
                        <span className={styles.muted}>—</span>
                      ) : (
                        <strong className={styles.meritRank}>
                          {entry.rank}.°
                        </strong>
                      )}
                    </td>
                    <td>
                      <strong>
                        {entry.lastNames}, {entry.firstNames}
                      </strong>
                      {entry.status === "retirado" ? (
                        <small className={styles.meritStudentNote}>
                          Participó hasta el {entry.withdrawnFromTerm}.° bimestre
                        </small>
                      ) : null}
                    </td>
                    <td className={styles.meritAverage}>
                      {averageLabel(entry.averageVisible)}
                    </td>
                    <td>
                      {entry.recordedGrades}/{ranking.expectedGrades}
                    </td>
                    <td>
                      {entry.average === null ? (
                        <span className={styles.meritPending}>Sin notas</span>
                      ) : entry.complete ? (
                        <span className={styles.meritComplete}>Completo</span>
                      ) : (
                        <span className={styles.meritProvisional}>
                          Faltan {entry.missingGrades}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.meritFootnotes}>
            <p>
              Los empates exactos comparten puesto mediante ranking denso; por
              ejemplo: 1, 2, 2, 3.
            </p>
            {ranking.excludedStudents ? (
              <p>
                {ranking.excludedStudents} alumno(s) retirados no participan en
                este bimestre.
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
