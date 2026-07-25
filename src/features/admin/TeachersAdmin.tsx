"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Alert, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/(dashboard)/admin/AdminPages.module.css";

type Teacher = {
  apellidos: string;
  created_at: string;
  dni: string;
  id: string;
  must_change_password: boolean;
  nombres: string;
  status: "pendiente" | "activo" | "inactivo";
};

type ApiResponse = {
  error?: string;
  message?: string;
};

async function authenticatedRequest(
  teacherId: string,
  body: Record<string, string>,
) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("La sesión administradora expiró.");

  const response = await fetch(`/api/admin/teachers/${teacherId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as ApiResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo completar la operación.");
  }
  return payload.message ?? "Operación completada.";
}

export function TeachersAdmin() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadTeachers = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from("profiles")
      .select(
        "id, dni, nombres, apellidos, status, must_change_password, created_at",
      )
      .eq("role", "docente")
      .order("created_at", { ascending: false });

    if (queryError) throw new Error(queryError.message);
    setTeachers((data ?? []) as Teacher[]);
  }, []);

  useEffect(() => {
    let active = true;
    loadTeachers()
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar las docentes.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadTeachers]);

  async function changeStatus(teacher: Teacher) {
    const nextStatus = teacher.status === "activo" ? "inactivo" : "activo";
    setBusy(`status:${teacher.id}`);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ status: nextStatus })
        .eq("id", teacher.id)
        .eq("role", "docente")
        .select(
          "id, dni, nombres, apellidos, status, must_change_password, created_at",
        )
        .single();

      if (updateError) throw new Error(updateError.message);
      setTeachers((current) =>
        current.map((item) =>
          item.id === teacher.id ? (data as Teacher) : item,
        ),
      );
      setMessage(
        nextStatus === "activo"
          ? "Cuenta docente aprobada y activa."
          : "Cuenta docente desactivada.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cambiar el estado.",
      );
    } finally {
      setBusy("");
    }
  }

  async function updateDetails(
    event: FormEvent<HTMLFormElement>,
    teacherId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(`details:${teacherId}`);
    setError("");
    setMessage("");

    try {
      const result = await authenticatedRequest(teacherId, {
        operation: "details",
        dni: String(form.get("dni") ?? ""),
        nombres: String(form.get("nombres") ?? ""),
        apellidos: String(form.get("apellidos") ?? ""),
      });
      await loadTeachers();
      setMessage(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudieron actualizar los datos.",
      );
    } finally {
      setBusy("");
    }
  }

  async function setTemporaryPassword(
    event: FormEvent<HTMLFormElement>,
    teacherId: string,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(`password:${teacherId}`);
    setError("");
    setMessage("");

    try {
      const result = await authenticatedRequest(teacherId, {
        operation: "temporary-password",
        password: String(form.get("password") ?? ""),
      });
      await loadTeachers();
      formElement.reset();
      setMessage(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo asignar la contraseña temporal.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Accesos institucionales</p>
          <h1>Docentes</h1>
          <p>
            Aprueba solicitudes, corrige datos y administra la recuperación de
            acceso sin recargar la página.
          </p>
        </div>
      </header>

      {message ? (
        <p className={`${styles.notice} ${styles.success}`} role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <Alert title="No se pudo completar la operación" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      {loading ? (
        <Spinner label="Cargando docentes" />
      ) : !teachers.length ? (
        <p className={styles.empty}>Todavía no hay solicitudes docentes.</p>
      ) : (
        <section aria-label="Cuentas docentes" className={styles.grid}>
          {teachers.map((teacher) => {
            const badgeClass =
              teacher.status === "activo"
                ? styles.badgeActive
                : teacher.status === "pendiente"
                  ? styles.badgePending
                  : styles.badgeInactive;

            return (
              <article className={styles.item} key={teacher.id}>
                <header className={styles.itemHeader}>
                  <div>
                    <h2>
                      {teacher.nombres} {teacher.apellidos}
                    </h2>
                    <p>DNI {teacher.dni}</p>
                  </div>
                  <span className={`${styles.badge} ${badgeClass}`}>
                    {teacher.status}
                  </span>
                </header>

                <form
                  className={styles.form}
                  onSubmit={(event) => updateDetails(event, teacher.id)}
                >
                  <div className={styles.formGrid}>
                    <label>
                      Nombres
                      <input
                        defaultValue={teacher.nombres}
                        maxLength={80}
                        minLength={2}
                        name="nombres"
                        required
                      />
                    </label>
                    <label>
                      Apellidos
                      <input
                        defaultValue={teacher.apellidos}
                        maxLength={100}
                        minLength={2}
                        name="apellidos"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    DNI
                    <input
                      defaultValue={teacher.dni}
                      inputMode="numeric"
                      maxLength={8}
                      minLength={8}
                      name="dni"
                      pattern="[0-9]{8}"
                      required
                    />
                  </label>
                  <div className={styles.actions}>
                    <button
                      className={styles.buttonSecondary}
                      disabled={Boolean(busy)}
                      type="submit"
                    >
                      {busy === `details:${teacher.id}`
                        ? "Guardando…"
                        : "Guardar datos"}
                    </button>
                  </div>
                </form>

                <hr className={styles.divider} />

                <div className={styles.actions}>
                  <button
                    className={
                      teacher.status === "activo"
                        ? styles.buttonDanger
                        : styles.button
                    }
                    disabled={Boolean(busy)}
                    onClick={() => changeStatus(teacher)}
                    type="button"
                  >
                    {busy === `status:${teacher.id}`
                      ? "Procesando…"
                      : teacher.status === "pendiente"
                        ? "Aprobar cuenta"
                        : teacher.status === "activo"
                          ? "Desactivar"
                          : "Reactivar"}
                  </button>
                </div>

                {teacher.status !== "pendiente" ? (
                  <>
                    <hr className={styles.divider} />
                    <form
                      className={styles.form}
                      onSubmit={(event) =>
                        setTemporaryPassword(event, teacher.id)
                      }
                    >
                      <label>
                        Contraseña temporal
                        <input
                          autoComplete="new-password"
                          minLength={8}
                          name="password"
                          placeholder="Mínimo 8 caracteres"
                          required
                          type="password"
                        />
                      </label>
                      <div className={styles.actions}>
                        <button
                          className={styles.buttonSecondary}
                          disabled={Boolean(busy)}
                          type="submit"
                        >
                          {busy === `password:${teacher.id}`
                            ? "Asignando…"
                            : "Asignar contraseña temporal"}
                        </button>
                        {teacher.must_change_password ? (
                          <span
                            className={`${styles.badge} ${styles.badgePending}`}
                          >
                            Cambio pendiente
                          </span>
                        ) : null}
                      </div>
                    </form>
                  </>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
