"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Alert, Spinner } from "@/components/ui";
import {
  calculateTermAverage,
  denseRanks,
  finalVisible,
  type StudentGrade,
} from "@/domain/academic/calculations";
import {
  generateRecommendation,
  RECOMMENDATION_OBSERVATIONS,
  type RecommendationObservationId,
} from "@/domain/academic/recommendation-generator";
import { useGroupWorkspace } from "@/features/groups/GroupWorkspace";
import { createClient } from "@/lib/supabase/client";
import styles from "./Academic.module.css";
import { recommendationSchema } from "./schemas";

type Enrollment = {
  id: string;
  status: "activo" | "retirado";
  student: {
    first_names: string;
    last_names: string;
  };
  withdrawn_from_term: number | null;
};

type Area = {
  active: boolean;
  id: string;
  included_in_final: boolean;
};

type Subject = {
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

type RecommendationRow = {
  enrollment_id: string;
  term: number;
  text: string;
};

type TermStatistics = {
  average: number | null;
  expectedGrades: number;
  rank: number | null;
  rankedStudents: number;
  recordedGrades: number;
};

const TERMS = [1, 2, 3, 4] as const;
const MAX_OBSERVATIONS = 3;

function recommendationKey(enrollmentId: string, term: number) {
  return `${enrollmentId}:${term}`;
}

function eligibleForTerm(enrollment: Enrollment, term: number) {
  return (
    enrollment.status === "activo" ||
    enrollment.withdrawn_from_term === null ||
    term <= enrollment.withdrawn_from_term
  );
}

export function Recommendations() {
  const group = useGroupWorkspace();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [term, setTerm] = useState<1 | 2 | 3 | 4>(1);
  const [selectedObservations, setSelectedObservations] = useState<
    RecommendationObservationId[]
  >([]);
  const [suggestion, setSuggestion] = useState("");
  const [variant, setVariant] = useState(0);
  const [acceptIncomplete, setAcceptIncomplete] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRecommendations = useCallback(async () => {
    const supabase = createClient();
    const [
      enrollmentResult,
      recommendationResult,
      areaResult,
      subjectResult,
      gradeResult,
    ] = await Promise.all([
      supabase
        .from("enrollments")
        .select(
          "id, status, withdrawn_from_term, students!inner(first_names, last_names)",
        )
        .eq("group_id", group.id),
      supabase
        .from("recommendations")
        .select("enrollment_id, term, text")
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
        .eq("group_id", group.id),
    ]);
    const queryError =
      enrollmentResult.error ??
      recommendationResult.error ??
      areaResult.error ??
      subjectResult.error ??
      gradeResult.error;
    if (queryError) throw new Error(queryError.message);

    const enrollmentRows: Enrollment[] = (enrollmentResult.data ?? [])
      .map((row: Record<string, unknown>) => ({
        id: String(row.id),
        status: row.status as Enrollment["status"],
        student: row.students as Enrollment["student"],
        withdrawn_from_term:
          (row.withdrawn_from_term as number | null) ?? null,
      }))
      .sort((a: Enrollment, b: Enrollment) =>
        `${a.student.last_names} ${a.student.first_names}`.localeCompare(
          `${b.student.last_names} ${b.student.first_names}`,
          "es",
        ),
      );
    const stored = Object.fromEntries(
      ((recommendationResult.data ?? []) as RecommendationRow[]).map((item) => [
        recommendationKey(item.enrollment_id, item.term),
        item.text,
      ]),
    );

    setEnrollments(enrollmentRows);
    setAreas((areaResult.data ?? []) as Area[]);
    setSubjects((subjectResult.data ?? []) as Subject[]);
    setGrades((gradeResult.data ?? []) as GradeRow[]);
    setValues(stored);
    setSelectedEnrollmentId((current) =>
      enrollmentRows.some((enrollment) => enrollment.id === current)
        ? current
        : enrollmentRows[0]?.id || "",
    );
  }, [group.id]);

  useEffect(() => {
    let active = true;
    loadRecommendations()
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar las recomendaciones.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadRecommendations]);

  const statistics = useMemo(() => {
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
    const includedAreaIds = new Set(
      areas
        .filter((area) => area.active && area.included_in_final)
        .map((area) => area.id),
    );
    const expectedSubjectIds = new Set(
      subjects
        .filter(
          (subject) =>
            subject.active && includedAreaIds.has(subject.group_area_id),
        )
        .map((subject) => subject.id),
    );
    const next: Record<string, TermStatistics> = {};

    for (const currentTerm of TERMS) {
      const eligibleEnrollments = enrollments.filter((enrollment) =>
        eligibleForTerm(enrollment, currentTerm),
      );
      const averages = eligibleEnrollments.map((enrollment) => {
        const studentGrades: StudentGrade[] = grades
          .filter((grade) => grade.enrollment_id === enrollment.id)
          .map((grade) => ({
            score: grade.score,
            subjectId: grade.group_subject_id,
            term: grade.term,
          }));
        return {
          id: enrollment.id,
          score: calculateTermAverage(
            currentTerm,
            calculationAreas,
            calculationSubjects,
            studentGrades,
          ),
        };
      });
      const ranked = averages.filter(
        (item): item is { id: string; score: number } => item.score !== null,
      );
      const ranks = denseRanks(ranked);

      for (const enrollment of eligibleEnrollments) {
        const average =
          averages.find((item) => item.id === enrollment.id)?.score ?? null;
        const recordedGrades = grades.filter(
          (grade) =>
            grade.enrollment_id === enrollment.id &&
            grade.term === currentTerm &&
            grade.score !== null &&
            expectedSubjectIds.has(grade.group_subject_id),
        ).length;
        next[recommendationKey(enrollment.id, currentTerm)] = {
          average,
          expectedGrades: expectedSubjectIds.size,
          rank: ranks[enrollment.id] ?? null,
          rankedStudents: ranked.length,
          recordedGrades,
        };
      }
    }

    return next;
  }, [areas, enrollments, grades, subjects]);

  const key = recommendationKey(selectedEnrollmentId, term);
  const text = values[key] ?? "";
  const selectedEnrollment = enrollments.find(
    (item) => item.id === selectedEnrollmentId,
  );
  const selectedStatistics = statistics[key];
  const blocked =
    selectedEnrollment !== undefined &&
    !eligibleForTerm(selectedEnrollment, term);
  const missingGrades = selectedStatistics
    ? Math.max(
        0,
        selectedStatistics.expectedGrades - selectedStatistics.recordedGrades,
      )
    : 0;
  const incomplete = missingGrades > 0;

  function resetAssistant() {
    setSelectedObservations([]);
    setSuggestion("");
    setVariant(0);
    setAcceptIncomplete(false);
    setConfirmReplace(false);
  }

  function changeContext(enrollmentId: string, nextTerm: 1 | 2 | 3 | 4) {
    setSelectedEnrollmentId(enrollmentId);
    setTerm(nextTerm);
    setError("");
    setMessage("");
    resetAssistant();
  }

  function toggleObservation(id: RecommendationObservationId) {
    setSelectedObservations((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= MAX_OBSERVATIONS) return current;
      return [...current, id];
    });
    setSuggestion("");
    setConfirmReplace(false);
  }

  function createSuggestion() {
    if (!selectedEnrollment || !selectedStatistics) return;
    if (selectedStatistics.average === null) {
      setError(
        "Registra al menos una nota del bimestre antes de generar el borrador.",
      );
      return;
    }
    if (incomplete && !acceptIncomplete) {
      setError(
        "Confirma que entiendes que el promedio y el puesto todavía pueden cambiar.",
      );
      return;
    }

    const nextVariant = suggestion ? variant + 1 : variant;
    setSuggestion(
      generateRecommendation({
        firstName: selectedEnrollment.student.first_names,
        observationIds: selectedObservations,
        rank: selectedStatistics.rank,
        termAverage: selectedStatistics.average,
        variantSeed: `${selectedEnrollment.id}:${term}:${nextVariant}`,
      }),
    );
    setVariant(nextVariant);
    setConfirmReplace(false);
    setError("");
    setMessage("");
  }

  function applySuggestion() {
    if (!suggestion) return;
    setValues((current) => ({ ...current, [key]: suggestion }));
    setConfirmReplace(false);
    setMessage(
      "El borrador fue copiado. Revísalo y guarda la recomendación cuando esté lista.",
    );
  }

  function requestApplySuggestion() {
    if (text.trim() && text !== suggestion) {
      setConfirmReplace(true);
      return;
    }
    applySuggestion();
  }

  async function saveRecommendation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = recommendationSchema.safeParse({
      enrollmentId: selectedEnrollmentId,
      term,
      text,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa la recomendación.");
      return;
    }
    if (blocked) {
      setError("El alumno ya no participa en este bimestre.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("La sesión expiró.");
      const { error: saveError } = await supabase.from("recommendations").upsert(
        {
          enrollment_id: parsed.data.enrollmentId,
          group_id: group.id,
          term: parsed.data.term,
          text: parsed.data.text,
          updated_by: session.user.id,
        },
        { onConflict: "enrollment_id,term" },
      );
      if (saveError) throw new Error(saveError.message);
      setMessage("Recomendación guardada correctamente.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar la recomendación.",
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedName = useMemo(() => {
    if (!selectedEnrollment) return "";
    return `${selectedEnrollment.student.last_names}, ${selectedEnrollment.student.first_names}`;
  }, [selectedEnrollment]);

  return (
    <section className={styles.page}>
      <header className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Tutoría</p>
          <h2>Recomendaciones</h2>
          <p>
            Genera un borrador desde las notas y el mérito, edítalo y guarda
            hasta 300 caracteres por alumno y bimestre.
          </p>
        </div>
      </header>

      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? (
        <Alert title="No se pudo completar la operación" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      {loading ? (
        <Spinner label="Cargando recomendaciones" />
      ) : !enrollments.length ? (
        <p className={styles.empty}>
          Registra al menos un alumno antes de escribir recomendaciones.
        </p>
      ) : (
        <div className={styles.recommendationLayout}>
          <aside className={`${styles.panel} ${styles.studentSelector}`}>
            <h3>Alumnos</h3>
            {enrollments.map((enrollment) => {
              const name = `${enrollment.student.last_names}, ${enrollment.student.first_names}`;
              return (
                <button
                  className={`${styles.studentButton} ${
                    selectedEnrollmentId === enrollment.id
                      ? styles.studentButtonActive
                      : ""
                  }`}
                  key={enrollment.id}
                  onClick={() => changeContext(enrollment.id, term)}
                  type="button"
                >
                  {name}
                  {enrollment.status === "retirado" ? " · retirado" : ""}
                </button>
              );
            })}
          </aside>

          <form
            className={`${styles.panel} ${styles.form} ${styles.recommendationForm}`}
            onSubmit={saveRecommendation}
          >
            <h3>{selectedName}</h3>
            <label>
              Bimestre
              <select
                onChange={(event) =>
                  changeContext(
                    selectedEnrollmentId,
                    Number(event.target.value) as 1 | 2 | 3 | 4,
                  )
                }
                value={term}
              >
                <option value="1">1.er bimestre</option>
                <option value="2">2.º bimestre</option>
                <option value="3">3.er bimestre</option>
                <option value="4">4.º bimestre</option>
              </select>
            </label>

            {blocked ? (
              <p className={styles.warning}>
                El alumno no participa después de su bimestre de retiro.
              </p>
            ) : (
              <>
                <section
                  aria-label="Resumen académico del bimestre"
                  className={styles.academicSnapshot}
                >
                  <div>
                    <span>Promedio</span>
                    <strong>
                      {selectedStatistics?.average === null ||
                      selectedStatistics?.average === undefined
                        ? "—"
                        : finalVisible(selectedStatistics.average)?.toFixed(1)}
                    </strong>
                  </div>
                  <div>
                    <span>Orden de mérito</span>
                    <strong>
                      {selectedStatistics?.rank
                        ? `${selectedStatistics.rank} de ${selectedStatistics.rankedStudents}`
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Notas registradas</span>
                    <strong>
                      {selectedStatistics
                        ? `${selectedStatistics.recordedGrades} de ${selectedStatistics.expectedGrades}`
                        : "—"}
                    </strong>
                  </div>
                </section>

                {incomplete ? (
                  <div className={styles.incompleteWarning}>
                    <p>
                      Faltan {missingGrades} nota(s) del bimestre. El promedio y
                      el puesto todavía podrían cambiar.
                    </p>
                    <label className={styles.checkboxLine}>
                      <input
                        checked={acceptIncomplete}
                        onChange={(event) =>
                          setAcceptIncomplete(event.target.checked)
                        }
                        type="checkbox"
                      />
                      Entiendo y deseo generar un borrador provisional.
                    </label>
                  </div>
                ) : null}

                <section className={styles.assistantPanel}>
                  <div className={styles.assistantHeading}>
                    <div>
                      <h4>Observaciones de la docente</h4>
                      <p>
                        Selecciona hasta {MAX_OBSERVATIONS}. Las conductas nunca
                        se deducen de las notas.
                      </p>
                    </div>
                    <span>
                      {selectedObservations.length}/{MAX_OBSERVATIONS}
                    </span>
                  </div>

                  {(["fortaleza", "mejora"] as const).map((tone) => (
                    <div className={styles.observationGroup} key={tone}>
                      <strong>
                        {tone === "fortaleza"
                          ? "Fortalezas"
                          : "Aspectos por mejorar"}
                      </strong>
                      <div className={styles.observationChips}>
                        {RECOMMENDATION_OBSERVATIONS.filter(
                          (observation) => observation.tone === tone,
                        ).map((observation) => {
                          const selected = selectedObservations.includes(
                            observation.id,
                          );
                          const limitReached =
                            !selected &&
                            selectedObservations.length >= MAX_OBSERVATIONS;
                          return (
                            <button
                              aria-pressed={selected}
                              className={`${styles.observationChip} ${
                                selected ? styles.observationChipSelected : ""
                              }`}
                              disabled={limitReached}
                              key={observation.id}
                              onClick={() =>
                                toggleObservation(observation.id)
                              }
                              type="button"
                            >
                              {observation.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className={styles.actions}>
                    <button
                      className={styles.secondaryButton}
                      disabled={
                        selectedStatistics?.average === null ||
                        selectedStatistics?.average === undefined ||
                        (incomplete && !acceptIncomplete)
                      }
                      onClick={createSuggestion}
                      type="button"
                    >
                      {suggestion
                        ? "Generar otra sugerencia"
                        : "Generar borrador"}
                    </button>
                  </div>

                  {suggestion ? (
                    <div className={styles.suggestionBox}>
                      <div>
                        <strong>Borrador sugerido</strong>
                        <span>{suggestion.length}/300</span>
                      </div>
                      <p>{suggestion}</p>
                      <button
                        className={styles.button}
                        onClick={requestApplySuggestion}
                        type="button"
                      >
                        Usar esta sugerencia
                      </button>
                    </div>
                  ) : null}

                  {confirmReplace ? (
                    <div className={styles.inlineConfirmation}>
                      <p>
                        Ya existe un texto escrito. ¿Deseas reemplazarlo con el
                        borrador?
                      </p>
                      <div className={styles.actions}>
                        <button
                          className={styles.dangerButton}
                          onClick={applySuggestion}
                          type="button"
                        >
                          Reemplazar texto
                        </button>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => setConfirmReplace(false)}
                          type="button"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            )}

            <label>
              Recomendación final de la tutora
              <textarea
                disabled={blocked}
                maxLength={300}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                placeholder="Escribe una recomendación o utiliza el generador de borradores…"
                value={text}
              />
            </label>
            <div className={styles.counter}>
              <span>Solo se guarda este texto final.</span>
              <span>{text.length}/300</span>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.button}
                disabled={saving || blocked}
                type="submit"
              >
                {saving ? "Guardando…" : "Guardar recomendación"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
