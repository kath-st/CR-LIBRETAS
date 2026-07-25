"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Alert, Spinner } from "@/components/ui";
import {
  calculateStudentResult,
  visibleInteger,
  type StudentGrade,
} from "@/domain/academic/calculations";
import { SaveVersionTracker } from "@/domain/academic/autosave";
import { useGroupWorkspace } from "@/features/groups/GroupWorkspace";
import { createClient } from "@/lib/supabase/client";
import styles from "./Academic.module.css";
import { gradeInputSchema } from "./schemas";

type Enrollment = {
  id: string;
  student: {
    first_names: string;
    last_names: string;
  };
};

type Area = {
  active: boolean;
  id: string;
  included_in_final: boolean;
  name: string;
  position: number;
};

type Subject = {
  active: boolean;
  group_area_id: string;
  id: string;
  name: string;
  position: number;
};

type GradeRow = {
  enrollment_id: string;
  group_subject_id: string;
  score: number | null;
  term: 1 | 2 | 3 | 4;
};

type SaveState = "guardando" | "guardado" | "error";
type PendingSave = { score: number | null; version: number };
type GradebookView = "por-asignatura" | "por-alumno";

const TERMS = [1, 2, 3, 4] as const;

function cellKey(enrollmentId: string, subjectId: string, term: number) {
  return `${enrollmentId}:${subjectId}:${term}`;
}

export function Gradebook() {
  const group = useGroupWorkspace();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [gradeValues, setGradeValues] = useState<Record<string, number | null>>(
    {},
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [view, setView] = useState<GradebookView>("por-asignatura");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const versions = useRef(new SaveVersionTracker());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, PendingSave>());
  const mounted = useRef(true);

  const persistGrade = useCallback(
    async (key: string, job: PendingSave) => {
      if (!userId) return;
      const [enrollmentId, subjectId, rawTerm] = key.split(":");
      const term = Number(rawTerm);
      const supabase = createClient();
      const { error: saveError } = await supabase.from("grades").upsert(
        {
          enrollment_id: enrollmentId,
          group_id: group.id,
          group_subject_id: subjectId,
          score: job.score,
          term,
          updated_by: userId,
        },
        { onConflict: "enrollment_id,group_subject_id,term" },
      );

      if (versions.current.isCurrent(key, job.version)) {
        if (!saveError) pending.current.delete(key);
        if (mounted.current) {
          setSaveStates((current) => ({
            ...current,
            [key]: saveError ? "error" : "guardado",
          }));
          if (saveError) {
            setCellErrors((current) => ({
              ...current,
              [key]: "No se pudo guardar. Sal de la celda para reintentar.",
            }));
          }
        }
      }
    },
    [group.id, userId],
  );

  const loadGradebook = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("La sesión expiró.");

    const [enrollmentResult, areaResult, subjectResult, gradeResult] =
      await Promise.all([
        supabase
          .from("enrollments")
          .select("id, students!inner(first_names, last_names)")
          .eq("group_id", group.id)
          .eq("status", "activo"),
        supabase
          .from("group_areas")
          .select(
            "id, name, position, active, included_in_final",
          )
          .eq("group_id", group.id)
          .eq("active", true)
          .order("position"),
        supabase
          .from("group_subjects")
          .select("id, group_area_id, name, position, active")
          .eq("group_id", group.id)
          .eq("active", true)
          .order("position"),
        supabase
          .from("grades")
          .select("enrollment_id, group_subject_id, term, score")
          .eq("group_id", group.id),
      ]);

    const queryError =
      enrollmentResult.error ??
      areaResult.error ??
      subjectResult.error ??
      gradeResult.error;
    if (queryError) throw new Error(queryError.message);

    const enrollmentRows: Enrollment[] = (enrollmentResult.data ?? [])
      .map((row: Record<string, unknown>) => ({
        id: String(row.id),
        student: row.students as Enrollment["student"],
      }))
      .sort((a: Enrollment, b: Enrollment) =>
        `${a.student.last_names} ${a.student.first_names}`.localeCompare(
          `${b.student.last_names} ${b.student.first_names}`,
          "es",
        ),
      );
    const areaRows = (areaResult.data ?? []) as Area[];
    const subjectRows = (subjectResult.data ?? []) as Subject[];
    const storedGrades = (gradeResult.data ?? []) as GradeRow[];
    const nextValues: Record<string, number | null> = {};
    const nextDrafts: Record<string, string> = {};
    for (const grade of storedGrades) {
      const key = cellKey(
        grade.enrollment_id,
        grade.group_subject_id,
        grade.term,
      );
      nextValues[key] = grade.score;
      nextDrafts[key] = grade.score === null ? "" : String(grade.score);
    }

    setUserId(session.user.id);
    setEnrollments(enrollmentRows);
    setAreas(areaRows);
    setSubjects(subjectRows);
    setGradeValues(nextValues);
    setDrafts(nextDrafts);
    setSelectedSubjectId((current) =>
      subjectRows.some((subject) => subject.id === current)
        ? current
        : subjectRows[0]?.id || "",
    );
    setSelectedEnrollmentId((current) =>
      enrollmentRows.some((enrollment) => enrollment.id === current)
        ? current
        : enrollmentRows[0]?.id || "",
    );
  }, [group.id]);

  useEffect(() => {
    mounted.current = true;
    const activeTimers = timers.current;
    const pendingSaves = pending.current;
    loadGradebook()
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo cargar el registro de notas.",
        ),
      )
      .finally(() => setLoading(false));

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!pending.current.size) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      for (const timer of activeTimers.values()) clearTimeout(timer);
      activeTimers.clear();
      for (const [key, job] of pendingSaves) {
        void persistGrade(key, job);
      }
    };
  }, [loadGradebook, persistGrade]);

  function scheduleSave(key: string, score: number | null) {
    const version = versions.current.next(key);
    const job = { score, version };
    pending.current.set(key, job);
    const previous = timers.current.get(key);
    if (previous) clearTimeout(previous);
    setSaveStates((current) => ({ ...current, [key]: "guardando" }));
    const timer = setTimeout(() => {
      timers.current.delete(key);
      void persistGrade(key, job);
    }, 450);
    timers.current.set(key, timer);
  }

  function flushCell(key: string) {
    const timer = timers.current.get(key);
    const job = pending.current.get(key);
    if (!job) return;
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(key);
    }
    void persistGrade(key, job);
  }

  function changeGrade(
    event: ChangeEvent<HTMLInputElement>,
    enrollmentId: string,
    subjectId: string,
    term: 1 | 2 | 3 | 4,
  ) {
    const key = cellKey(enrollmentId, subjectId, term);
    const raw = event.target.value.trim();
    setDrafts((current) => ({ ...current, [key]: raw }));
    const parsed = gradeInputSchema.safeParse(raw);
    if (!parsed.success) {
      setCellErrors((current) => ({
        ...current,
        [key]: "Usa un entero de 0 a 20 o deja la celda vacía.",
      }));
      return;
    }

    const score = parsed.data === "" ? null : parsed.data;
    setCellErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setGradeValues((current) => ({ ...current, [key]: score }));
    scheduleSave(key, score);
  }

  function moveVertically(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnKeys: string[],
  ) {
    if (!["Enter", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    const direction = event.key === "ArrowUp" ? -1 : 1;
    const nextKey = columnKeys[rowIndex + direction];
    if (!nextKey) return;
    event.preventDefault();
    const selector = `[data-grade-input="${nextKey}"]`;
    document.querySelector<HTMLInputElement>(selector)?.focus();
  }

  const areaById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas],
  );
  const selectedSubject = subjects.find(
    (subject) => subject.id === selectedSubjectId,
  );
  const selectedEnrollment = enrollments.find(
    (enrollment) => enrollment.id === selectedEnrollmentId,
  );
  const orderedSubjects = useMemo(
    () =>
      areas.flatMap((area) =>
        subjects.filter((subject) => subject.group_area_id === area.id),
      ),
    [areas, subjects],
  );

  const results = useMemo(() => {
    const calculationAreas = areas.map((area) => ({
      active: area.active,
      id: area.id,
      includedInFinal: area.included_in_final,
    }));
    const calculationSubjects = subjects.map((subject) => ({
      active: subject.active,
      areaId: subject.group_area_id,
      id: subject.id,
    }));

    return Object.fromEntries(
      enrollments.map((enrollment) => {
        const studentGrades: StudentGrade[] = subjects.flatMap((subject) =>
          TERMS.map((term) => ({
            score:
              gradeValues[cellKey(enrollment.id, subject.id, term)] ?? null,
            subjectId: subject.id,
            term,
          })),
        );
        return [
          enrollment.id,
          calculateStudentResult(
            calculationAreas,
            calculationSubjects,
            studentGrades,
          ),
        ];
      }),
    );
  }, [areas, enrollments, gradeValues, subjects]);

  const stateValues = Object.values(saveStates);
  const savingCount = stateValues.filter((state) => state === "guardando").length;
  const saveErrorCount = stateValues.filter((state) => state === "error").length;
  const selectedStudentResult = selectedEnrollment
    ? results[selectedEnrollment.id]
    : undefined;

  return (
    <section className={styles.page}>
      <header className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Notas y cálculos</p>
          <h2>Registro bimestral</h2>
          <p>
            Las celdas vacías son notas pendientes; el cero es una nota válida.
            Los cambios se guardan automáticamente.
          </p>
        </div>
        <div
          className={`${styles.saveState} ${
            saveErrorCount ? styles.saveError : ""
          }`}
          role="status"
        >
          {saveErrorCount
            ? `${saveErrorCount} celda(s) con error`
            : savingCount
              ? `Guardando ${savingCount} cambio(s)…`
              : stateValues.length
                ? "Todos los cambios guardados"
                : "Sin cambios pendientes"}
        </div>
      </header>

      {error ? (
        <Alert title="No se pudo abrir el registro de notas" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      {loading ? (
        <Spinner label="Cargando notas" />
      ) : !enrollments.length ? (
        <p className={styles.empty}>
          No hay alumnos activos. Registra o reactiva al menos uno antes de
          ingresar notas.
        </p>
      ) : !subjects.length ? (
        <p className={styles.empty}>
          Activa al menos una asignatura en la malla del grupo.
        </p>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.modePicker}>
              <span>Forma de registro</span>
              <div
                aria-label="Forma de registro de notas"
                className={styles.viewSwitch}
                role="group"
              >
                <button
                  aria-pressed={view === "por-asignatura"}
                  className={
                    view === "por-asignatura" ? styles.viewSwitchActive : ""
                  }
                  onClick={() => setView("por-asignatura")}
                  type="button"
                >
                  Por asignatura
                </button>
                <button
                  aria-pressed={view === "por-alumno"}
                  className={
                    view === "por-alumno" ? styles.viewSwitchActive : ""
                  }
                  onClick={() => setView("por-alumno")}
                  type="button"
                >
                  Por alumno
                </button>
              </div>
            </div>

            {view === "por-asignatura" ? (
              <>
                <label className={styles.field}>
                  Asignatura
                  <select
                    onChange={(event) =>
                      setSelectedSubjectId(event.target.value)
                    }
                    value={selectedSubjectId}
                  >
                    {areas.map((area) => (
                      <optgroup key={area.id} label={area.name}>
                        {subjects
                          .filter(
                            (subject) => subject.group_area_id === area.id,
                          )
                          .map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <div className={styles.muted}>
                  {selectedSubject
                    ? `${areaById.get(selectedSubject.group_area_id)?.name ?? ""} · ${
                        selectedSubject.name
                      }`
                    : ""}
                </div>
              </>
            ) : (
              <>
                <label className={styles.field}>
                  Alumno
                  <select
                    onChange={(event) =>
                      setSelectedEnrollmentId(event.target.value)
                    }
                    value={selectedEnrollmentId}
                  >
                    {enrollments.map((enrollment) => (
                      <option key={enrollment.id} value={enrollment.id}>
                        {enrollment.student.last_names},{" "}
                        {enrollment.student.first_names}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.studentSummary}>
                  <span>Promedio general</span>
                  <strong>{selectedStudentResult?.finalVisible ?? "—"}</strong>
                </div>
              </>
            )}
          </div>

          {view === "por-asignatura" ? (
            <div className={styles.tableWrap}>
              <table className={styles.gradeTable}>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    {TERMS.map((term) => (
                      <th key={term}>{term}B</th>
                    ))}
                    <th>P</th>
                    <th>Prom. general</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enrollment, rowIndex) => {
                    const result = results[enrollment.id];
                    const subjectAverage =
                      result?.subjectAverages[selectedSubjectId] ?? null;
                    return (
                      <tr key={enrollment.id}>
                        <td>
                          <strong>
                            {enrollment.student.last_names},{" "}
                            {enrollment.student.first_names}
                          </strong>
                        </td>
                        {TERMS.map((term) => {
                          const key = cellKey(
                            enrollment.id,
                            selectedSubjectId,
                            term,
                          );
                          const columnKeys = enrollments.map((item) =>
                            cellKey(item.id, selectedSubjectId, term),
                          );
                          return (
                            <td key={term}>
                              <input
                                aria-label={`${term}B de ${selectedSubject?.name ?? "la asignatura"} para ${enrollment.student.last_names}, ${enrollment.student.first_names}`}
                                className={`${styles.gradeInput} ${
                                  cellErrors[key]
                                    ? styles.gradeInputError
                                    : ""
                                }`}
                                data-grade-input={key}
                                inputMode="numeric"
                                maxLength={2}
                                onBlur={() => flushCell(key)}
                                onChange={(event) =>
                                  changeGrade(
                                    event,
                                    enrollment.id,
                                    selectedSubjectId,
                                    term,
                                  )
                                }
                                onKeyDown={(event) =>
                                  moveVertically(event, rowIndex, columnKeys)
                                }
                                title={cellErrors[key]}
                                value={drafts[key] ?? ""}
                              />
                            </td>
                          );
                        })}
                        <td className={styles.average}>
                          {visibleInteger(subjectAverage) ?? "—"}
                        </td>
                        <td className={styles.average}>
                          {result?.finalVisible ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : selectedEnrollment ? (
            <div className={styles.tableWrap}>
              <table
                className={`${styles.gradeTable} ${styles.studentGradeTable}`}
              >
                <thead>
                  <tr>
                    <th>Área</th>
                    <th>Asignatura</th>
                    {TERMS.map((term) => (
                      <th key={term}>{term}B</th>
                    ))}
                    <th>P</th>
                    <th>Prom. área</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSubjects.map((subject, rowIndex) => {
                    const area = areaById.get(subject.group_area_id);
                    const subjectAverage =
                      selectedStudentResult?.subjectAverages[subject.id] ??
                      null;
                    return (
                      <tr key={subject.id}>
                        <td className={styles.areaCell}>{area?.name ?? ""}</td>
                        <td className={styles.subjectCell}>{subject.name}</td>
                        {TERMS.map((term) => {
                          const key = cellKey(
                            selectedEnrollment.id,
                            subject.id,
                            term,
                          );
                          const columnKeys = orderedSubjects.map((item) =>
                            cellKey(selectedEnrollment.id, item.id, term),
                          );
                          return (
                            <td key={term}>
                              <input
                                aria-label={`${term}B de ${subject.name} para ${selectedEnrollment.student.last_names}, ${selectedEnrollment.student.first_names}`}
                                className={`${styles.gradeInput} ${
                                  cellErrors[key]
                                    ? styles.gradeInputError
                                    : ""
                                }`}
                                data-grade-input={key}
                                inputMode="numeric"
                                maxLength={2}
                                onBlur={() => flushCell(key)}
                                onChange={(event) =>
                                  changeGrade(
                                    event,
                                    selectedEnrollment.id,
                                    subject.id,
                                    term,
                                  )
                                }
                                onKeyDown={(event) =>
                                  moveVertically(event, rowIndex, columnKeys)
                                }
                                title={cellErrors[key]}
                                value={drafts[key] ?? ""}
                              />
                            </td>
                          );
                        })}
                        <td className={styles.average}>
                          {visibleInteger(subjectAverage) ?? "—"}
                        </td>
                        <td className={styles.average}>
                          {visibleInteger(
                            selectedStudentResult?.areaAverages[
                              subject.group_area_id
                            ] ?? null,
                          ) ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
