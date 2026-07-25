"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Alert, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/(dashboard)/admin/AdminPages.module.css";

type Teacher = {
  apellidos: string;
  id: string;
  nombres: string;
};

type Group = {
  academic_year: number;
  active: boolean;
  display_name: string;
  grade: number;
  id: string;
  level: "primaria" | "secundaria";
  section: string;
  teacher_id: string;
};

type GroupValues = Omit<Group, "id">;

const GROUP_COLUMNS =
  "id, academic_year, level, grade, section, display_name, teacher_id, active";

function labelForGrade(grade: number) {
  return `${grade}${
    grade === 1 || grade === 3 ? "ro" : grade === 2 ? "do" : "to"
  }`;
}

function valuesFromForm(form: FormData): GroupValues {
  const academicYear = Number(form.get("academicYear"));
  const level = String(form.get("level")) as Group["level"];
  const grade = Number(form.get("grade"));
  const section = String(form.get("section") ?? "").trim();
  const teacherId = String(form.get("teacherId") ?? "");
  const customName = String(form.get("displayName") ?? "").trim();
  const maximumGrade = level === "primaria" ? 6 : 5;

  if (
    !Number.isInteger(academicYear) ||
    academicYear < 2020 ||
    academicYear > 2100 ||
    !["primaria", "secundaria"].includes(level) ||
    !Number.isInteger(grade) ||
    grade < 1 ||
    grade > maximumGrade ||
    !section ||
    !teacherId
  ) {
    throw new Error("Revisa el año, nivel, grado, sección y docente.");
  }

  return {
    academic_year: academicYear,
    active: String(form.get("active")) !== "false",
    display_name:
      customName ||
      `${academicYear} - ${
        level === "primaria" ? "Primaria" : "Secundaria"
      } - ${labelForGrade(grade)} - ${section}`,
    grade,
    level,
    section,
    teacher_id: teacherId,
  };
}

export function GroupsAdmin() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [
      { data: teacherData, error: teachersError },
      { data: groupData, error: groupsError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nombres, apellidos")
        .eq("role", "docente")
        .eq("status", "activo")
        .order("apellidos"),
      supabase
        .from("academic_groups")
        .select(GROUP_COLUMNS)
        .order("academic_year", { ascending: false })
        .order("level")
        .order("grade"),
    ]);

    if (teachersError || groupsError) {
      throw new Error(
        teachersError?.message ??
          groupsError?.message ??
          "No se pudieron cargar los grupos.",
      );
    }

    setTeachers((teacherData ?? []) as Teacher[]);
    setGroups((groupData ?? []) as Group[]);
  }, []);

  useEffect(() => {
    let active = true;
    loadData()
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar los grupos.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadData]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy("create");
    setError("");
    setMessage("");

    try {
      const values = valuesFromForm(new FormData(formElement));
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("La sesión administradora expiró.");

      const { data, error: insertError } = await supabase
        .from("academic_groups")
        .insert({ ...values, created_by: session.user.id })
        .select(GROUP_COLUMNS)
        .single();

      if (insertError) {
        throw new Error(
          insertError.code === "23505"
            ? "Ya existe un grupo con ese año, nivel, grado y sección."
            : insertError.message,
        );
      }

      setGroups((current) => [data as Group, ...current]);
      formElement.reset();
      setMessage("Grupo creado y asignado correctamente.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo crear el grupo.",
      );
    } finally {
      setBusy("");
    }
  }

  async function updateGroup(
    event: FormEvent<HTMLFormElement>,
    groupId: string,
  ) {
    event.preventDefault();
    setBusy(`update:${groupId}`);
    setError("");
    setMessage("");

    try {
      const values = valuesFromForm(new FormData(event.currentTarget));
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("academic_groups")
        .update(values)
        .eq("id", groupId)
        .select(GROUP_COLUMNS)
        .single();

      if (updateError) {
        throw new Error(
          updateError.code === "23505"
            ? "Ya existe otro grupo con esos datos."
            : updateError.message,
        );
      }

      setGroups((current) =>
        current.map((item) => (item.id === groupId ? (data as Group) : item)),
      );
      setMessage("Grupo actualizado correctamente.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el grupo.",
      );
    } finally {
      setBusy("");
    }
  }

  const teacherById = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers],
  );

  return (
    <>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Organización académica</p>
          <h1>Grupos</h1>
          <p>
            Crea grados y secciones, y asigna una docente sin recargar la
            página.
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

      <section className={styles.section}>
        <h2>Crear grupo</h2>
        <div className={styles.panel}>
          {loading ? (
            <Spinner label="Cargando grupos" />
          ) : !teachers.length ? (
            <p className={styles.empty}>
              Primero debes aprobar al menos una cuenta docente.
            </p>
          ) : (
            <form className={styles.form} onSubmit={createGroup}>
              <div className={styles.formGrid}>
                <label>
                  Año académico
                  <input
                    defaultValue={new Date().getFullYear()}
                    max={2100}
                    min={2020}
                    name="academicYear"
                    required
                    type="number"
                  />
                </label>
                <label>
                  Nivel
                  <select defaultValue="primaria" name="level" required>
                    <option value="primaria">Primaria</option>
                    <option value="secundaria">Secundaria</option>
                  </select>
                </label>
                <label>
                  Grado
                  <input
                    max={6}
                    min={1}
                    name="grade"
                    required
                    type="number"
                  />
                </label>
                <label>
                  Sección
                  <input
                    defaultValue="Única"
                    maxLength={30}
                    name="section"
                    required
                  />
                </label>
              </div>
              <label>
                Docente responsable
                <select name="teacherId" required>
                  <option value="">Selecciona una docente</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.apellidos}, {teacher.nombres}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nombre visible opcional
                <input
                  maxLength={120}
                  name="displayName"
                  placeholder="Se generará automáticamente si queda vacío"
                />
              </label>
              <input name="active" type="hidden" value="true" />
              <div className={styles.actions}>
                <button
                  className={styles.button}
                  disabled={Boolean(busy)}
                  type="submit"
                >
                  {busy === "create" ? "Creando…" : "Crear y asignar grupo"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Grupos registrados</h2>
        {loading ? (
          <Spinner label="Cargando grupos registrados" />
        ) : !groups.length ? (
          <p className={styles.empty}>Todavía no hay grupos académicos.</p>
        ) : (
          <div className={styles.grid}>
            {groups.map((group) => {
              const teacher = teacherById.get(group.teacher_id);
              return (
                <article className={styles.item} key={group.id}>
                  <header className={styles.itemHeader}>
                    <div>
                      <h3>{group.display_name}</h3>
                      <p>
                        {teacher
                          ? `${teacher.nombres} ${teacher.apellidos}`
                          : "Docente no disponible"}
                      </p>
                    </div>
                    <span
                      className={`${styles.badge} ${
                        group.active
                          ? styles.badgeActive
                          : styles.badgeInactive
                      }`}
                    >
                      {group.active ? "activo" : "inactivo"}
                    </span>
                  </header>

                  <form
                    className={styles.form}
                    onSubmit={(event) => updateGroup(event, group.id)}
                  >
                    <div className={styles.formGrid}>
                      <label>
                        Año
                        <input
                          defaultValue={group.academic_year}
                          max={2100}
                          min={2020}
                          name="academicYear"
                          required
                          type="number"
                        />
                      </label>
                      <label>
                        Nivel
                        <select
                          defaultValue={group.level}
                          name="level"
                          required
                        >
                          <option value="primaria">Primaria</option>
                          <option value="secundaria">Secundaria</option>
                        </select>
                      </label>
                      <label>
                        Grado
                        <input
                          defaultValue={group.grade}
                          max={6}
                          min={1}
                          name="grade"
                          required
                          type="number"
                        />
                      </label>
                      <label>
                        Sección
                        <input
                          defaultValue={group.section}
                          maxLength={30}
                          name="section"
                          required
                        />
                      </label>
                    </div>
                    <label>
                      Docente
                      <select
                        defaultValue={group.teacher_id}
                        name="teacherId"
                        required
                      >
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.apellidos}, {teacher.nombres}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nombre visible
                      <input
                        defaultValue={group.display_name}
                        maxLength={120}
                        name="displayName"
                      />
                    </label>
                    <label>
                      Estado
                      <select
                        defaultValue={String(group.active)}
                        name="active"
                        required
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    </label>
                    <div className={styles.actions}>
                      <Link
                        className={styles.button}
                        href={`/grupos/${group.id}`}
                      >
                        Abrir libreta
                      </Link>
                      <button
                        className={styles.buttonSecondary}
                        disabled={Boolean(busy)}
                        type="submit"
                      >
                        {busy === `update:${group.id}`
                          ? "Guardando…"
                          : "Guardar cambios"}
                      </button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
