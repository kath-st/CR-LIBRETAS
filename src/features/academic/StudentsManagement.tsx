"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Alert, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import styles from "./Academic.module.css";
import { studentSchema } from "./schemas";
import { useGroupWorkspace } from "@/features/groups/GroupWorkspace";
import { StudentImport } from "@/features/imports/StudentImport";

type Enrollment = {
  id: string;
  status: "activo" | "retirado";
  student: {
    first_names: string;
    id: string;
    last_names: string;
  };
  withdrawal_reason: string | null;
  withdrawn_from_term: number | null;
};

type StudentValues = {
  firstNames: string;
  lastNames: string;
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function StudentsManagement() {
  const group = useGroupWorkspace();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [filter, setFilter] = useState<"activo" | "retirado">("activo");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState<StudentValues | null>(null);
  const studentForm = useRef<HTMLFormElement>(null);

  const loadEnrollments = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from("enrollments")
      .select(
        "id, status, withdrawn_from_term, withdrawal_reason, students!inner(id, first_names, last_names)",
      )
      .eq("group_id", group.id)
      .order("created_at");

    if (queryError) throw new Error(queryError.message);
    setEnrollments(
      (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        status: row.status as Enrollment["status"],
        student: row.students as Enrollment["student"],
        withdrawal_reason: (row.withdrawal_reason as string | null) ?? null,
        withdrawn_from_term:
          (row.withdrawn_from_term as number | null) ?? null,
      })),
    );
  }, [group.id]);

  useEffect(() => {
    let active = true;
    loadEnrollments()
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar los alumnos.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadEnrollments]);

  function isPossibleDuplicate(values: StudentValues) {
    const target = normalizeName(`${values.lastNames} ${values.firstNames}`);
    return enrollments.some(
      ({ student }) =>
        normalizeName(`${student.last_names} ${student.first_names}`) === target,
    );
  }

  async function createEnrollment(values: StudentValues) {
    setBusy("create");
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("enroll_student", {
        student_first_names: values.firstNames,
        student_last_names: values.lastNames,
        target_group_id: group.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadEnrollments();
      setDuplicate(null);
      setMessage("Alumno registrado y matriculado correctamente.");
      studentForm.current?.reset();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo registrar al alumno.",
      );
    } finally {
      setBusy("");
    }
  }

  async function submitStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setDuplicate(null);
    const form = new FormData(event.currentTarget);
    const parsed = studentSchema.safeParse({
      firstNames: form.get("firstNames"),
      lastNames: form.get("lastNames"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    if (isPossibleDuplicate(parsed.data)) {
      setDuplicate(parsed.data);
      return;
    }
    await createEnrollment(parsed.data);
  }

  async function withdraw(
    event: FormEvent<HTMLFormElement>,
    enrollmentId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const term = Number(form.get("term"));
    const reason = String(form.get("reason") ?? "").trim();
    if (!Number.isInteger(term) || term < 1 || term > 4) {
      setError("Selecciona el bimestre de retiro.");
      return;
    }

    setBusy(enrollmentId);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("La sesión expiró.");
      const { error: updateError } = await supabase
        .from("enrollments")
        .update({
          status: "retirado",
          withdrawal_reason: reason || null,
          withdrawn_at: new Date().toISOString(),
          withdrawn_by: session.user.id,
          withdrawn_from_term: term,
        })
        .eq("id", enrollmentId)
        .eq("group_id", group.id);
      if (updateError) throw new Error(updateError.message);
      await loadEnrollments();
      setMessage("Matrícula retirada; el historial se conservó.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo retirar la matrícula.",
      );
    } finally {
      setBusy("");
    }
  }

  async function reactivate(enrollmentId: string) {
    setBusy(enrollmentId);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("enrollments")
        .update({
          status: "activo",
          withdrawal_reason: null,
          withdrawn_at: null,
          withdrawn_by: null,
          withdrawn_from_term: null,
        })
        .eq("id", enrollmentId)
        .eq("group_id", group.id);
      if (updateError) throw new Error(updateError.message);
      await loadEnrollments();
      setMessage("Matrícula reactivada correctamente.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo reactivar la matrícula.",
      );
    } finally {
      setBusy("");
    }
  }

  const visible = useMemo(
    () => enrollments.filter((item) => item.status === filter),
    [enrollments, filter],
  );

  return (
    <section className={styles.page}>
      <header className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Alumnos y matrículas</p>
          <h2>Alumnos del grupo</h2>
          <p>
            Registra cada alumno manualmente. Retirar una matrícula conserva
            todas sus notas y recomendaciones.
          </p>
        </div>
      </header>

      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? (
        <Alert title="No se pudo completar la operación" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      <div className={styles.panel}>
        <h3>Registrar y matricular alumno</h3>
        <form
          className={styles.form}
          onSubmit={submitStudent}
          ref={studentForm}
        >
          <div className={styles.formGrid}>
            <label>
              Apellidos
              <input maxLength={120} name="lastNames" required />
            </label>
            <label>
              Nombres
              <input maxLength={100} name="firstNames" required />
            </label>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.button}
              disabled={Boolean(busy)}
              type="submit"
            >
              {busy === "create" ? "Registrando…" : "Registrar alumno"}
            </button>
          </div>
        </form>
        {duplicate ? (
          <div className={styles.warning}>
            Ya existe una matrícula con el mismo nombre. Si se trata de otra
            persona, puedes continuar.
            <div className={styles.actions}>
              <button
                className={styles.secondaryButton}
                disabled={Boolean(busy)}
                onClick={() => createEnrollment(duplicate)}
                type="button"
              >
                Registrar de todas formas
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => setDuplicate(null)}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <StudentImport
        existingStudents={enrollments.map(({ student }) => ({
          firstNames: student.first_names,
          lastNames: student.last_names,
        }))}
        onImported={loadEnrollments}
      />

      <div className={styles.toolbar}>
        <label className={styles.field}>
          Mostrar matrículas
          <select
            onChange={(event) =>
              setFilter(event.target.value as "activo" | "retirado")
            }
            value={filter}
          >
            <option value="activo">Activas</option>
            <option value="retirado">Retiradas</option>
          </select>
        </label>
        <span className={styles.muted}>
          {visible.length} {visible.length === 1 ? "alumno" : "alumnos"}
        </span>
      </div>

      {loading ? (
        <Spinner label="Cargando alumnos" />
      ) : !visible.length ? (
        <p className={styles.empty}>
          {filter === "activo"
            ? "Todavía no hay alumnos activos en este grupo."
            : "No hay matrículas retiradas."}
        </p>
      ) : (
        <div className={styles.list}>
          {visible.map((enrollment) => (
            <article className={styles.card} key={enrollment.id}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>
                    {enrollment.student.last_names},{" "}
                    {enrollment.student.first_names}
                  </h3>
                  {enrollment.status === "retirado" ? (
                    <p>
                      Retiro desde {enrollment.withdrawn_from_term}B
                      {enrollment.withdrawal_reason
                        ? ` · ${enrollment.withdrawal_reason}`
                        : ""}
                    </p>
                  ) : (
                    <p>Matrícula activa</p>
                  )}
                </div>
                <span
                  className={`${styles.badge} ${
                    enrollment.status === "retirado"
                      ? styles.badgeRetired
                      : ""
                  }`}
                >
                  {enrollment.status}
                </span>
              </div>

              {enrollment.status === "activo" ? (
                <details className={styles.details}>
                  <summary>Retirar matrícula</summary>
                  <form
                    className={styles.form}
                    onSubmit={(event) => withdraw(event, enrollment.id)}
                  >
                    <div className={styles.formGrid}>
                      <label>
                        Retirar desde
                        <select defaultValue="1" name="term">
                          <option value="1">1.er bimestre</option>
                          <option value="2">2.º bimestre</option>
                          <option value="3">3.er bimestre</option>
                          <option value="4">4.º bimestre</option>
                        </select>
                      </label>
                      <label>
                        Motivo opcional
                        <input maxLength={300} name="reason" />
                      </label>
                    </div>
                    <button
                      className={styles.dangerButton}
                      disabled={Boolean(busy)}
                      type="submit"
                    >
                      {busy === enrollment.id
                        ? "Retirando…"
                        : "Confirmar retiro"}
                    </button>
                  </form>
                </details>
              ) : (
                <div className={styles.details}>
                  <button
                    className={styles.secondaryButton}
                    disabled={Boolean(busy)}
                    onClick={() => reactivate(enrollment.id)}
                    type="button"
                  >
                    {busy === enrollment.id
                      ? "Reactivando…"
                      : "Reactivar matrícula"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
