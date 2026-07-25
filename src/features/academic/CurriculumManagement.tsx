"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Alert, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useGroupWorkspace } from "@/features/groups/GroupWorkspace";
import styles from "./Academic.module.css";
import { customSubjectSchema } from "./schemas";

type Area = {
  active: boolean;
  id: string;
  included_in_final: boolean;
  is_direct: boolean;
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

export function CurriculumManagement() {
  const group = useGroupWorkspace();
  const [areas, setAreas] = useState<Area[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCurriculum = useCallback(async () => {
    const supabase = createClient();
    const [areaResult, subjectResult] = await Promise.all([
      supabase
        .from("group_areas")
        .select(
          "id, name, position, active, included_in_final, is_direct",
        )
        .eq("group_id", group.id)
        .order("position"),
      supabase
        .from("group_subjects")
        .select("id, group_area_id, name, position, active")
        .eq("group_id", group.id)
        .order("position"),
    ]);

    const queryError = areaResult.error ?? subjectResult.error;
    if (queryError) throw new Error(queryError.message);
    setAreas((areaResult.data ?? []) as Area[]);
    setSubjects((subjectResult.data ?? []) as Subject[]);
  }, [group.id]);

  useEffect(() => {
    let active = true;
    loadCurriculum()
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar la malla.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadCurriculum]);

  async function hasGrades(subjectIds: string[]) {
    if (!subjectIds.length) return false;
    const supabase = createClient();
    const { count, error: countError } = await supabase
      .from("grades")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id)
      .in("group_subject_id", subjectIds)
      .not("score", "is", null);
    if (countError) throw new Error(countError.message);
    return Boolean(count);
  }

  async function updateArea(
    area: Area,
    changes: Partial<Pick<Area, "active" | "included_in_final" | "position">>,
  ) {
    setBusy(`area:${area.id}`);
    setError("");
    setMessage("");
    try {
      if (changes.active === false) {
        const areaSubjects = subjects
          .filter((subject) => subject.group_area_id === area.id)
          .map((subject) => subject.id);
        if (
          (await hasGrades(areaSubjects)) &&
          !window.confirm(
            "Esta área tiene notas. Al desactivarla no se borrará el historial, pero cambiarán los promedios. ¿Continuar?",
          )
        ) {
          return;
        }
      }

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("group_areas")
        .update(changes)
        .eq("id", area.id)
        .eq("group_id", group.id);
      if (updateError) throw new Error(updateError.message);
      setAreas((current) =>
        current
          .map((item) => (item.id === area.id ? { ...item, ...changes } : item))
          .sort((a, b) => a.position - b.position),
      );
      setMessage("Malla actualizada correctamente.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el área.",
      );
    } finally {
      setBusy("");
    }
  }

  async function updateSubject(
    subject: Subject,
    changes: Partial<Pick<Subject, "active" | "position">>,
  ) {
    setBusy(`subject:${subject.id}`);
    setError("");
    setMessage("");
    try {
      if (
        changes.active === false &&
        (await hasGrades([subject.id])) &&
        !window.confirm(
          "Esta asignatura tiene notas. Se conservarán, pero dejarán de participar en los cálculos mientras esté inactiva. ¿Continuar?",
        )
      ) {
        return;
      }

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("group_subjects")
        .update(changes)
        .eq("id", subject.id)
        .eq("group_id", group.id);
      if (updateError) throw new Error(updateError.message);
      setSubjects((current) =>
        current
          .map((item) =>
            item.id === subject.id ? { ...item, ...changes } : item,
          )
          .sort((a, b) => a.position - b.position),
      );
      setMessage("Asignatura actualizada correctamente.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar la asignatura.",
      );
    } finally {
      setBusy("");
    }
  }

  async function addSubject(
    event: FormEvent<HTMLFormElement>,
    area: Area,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const parsed = customSubjectSchema.safeParse({
      areaId: area.id,
      name: form.get("name"),
      position: form.get("position"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa la asignatura.");
      return;
    }

    setBusy(`add:${area.id}`);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("group_subjects")
        .insert({
          active: true,
          group_area_id: area.id,
          group_id: group.id,
          name: parsed.data.name,
          position: parsed.data.position,
        })
        .select("id, group_area_id, name, position, active")
        .single();
      if (insertError) {
        throw new Error(
          insertError.code === "23505"
            ? "Ya existe una asignatura personalizada con ese nombre."
            : insertError.message,
        );
      }
      setSubjects((current) =>
        [...current, data as Subject].sort((a, b) => a.position - b.position),
      );
      formElement.reset();
      setMessage("Asignatura agregada a la malla del grupo.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo agregar la asignatura.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Configuración académica</p>
          <h2>Malla del grupo</h2>
          <p>
            Activa, ordena y decide qué áreas participan en el promedio final.
            Los cambios nunca eliminan notas existentes.
          </p>
        </div>
      </header>

      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? (
        <Alert title="No se pudo modificar la malla" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      <p className={styles.warning}>
        Conducta está excluida del promedio por defecto. Puedes incluirla desde
        el control de su área.
      </p>

      {loading ? (
        <Spinner label="Cargando malla" />
      ) : !areas.length ? (
        <p className={styles.empty}>
          Este grupo todavía no tiene una malla inicial. Verifica que la
          migración de Fase 3 haya sido aplicada.
        </p>
      ) : (
        <div className={styles.curriculum}>
          {areas.map((area) => {
            const areaSubjects = subjects.filter(
              (subject) => subject.group_area_id === area.id,
            );
            const nextPosition =
              Math.max(0, ...areaSubjects.map((subject) => subject.position)) +
              10;

            return (
              <article className={styles.areaCard} key={area.id}>
                <header className={styles.areaHeader}>
                  <div>
                    <h3>{area.name}</h3>
                    <p className={styles.muted}>
                      {area.is_direct
                        ? "Área de nota directa"
                        : `${areaSubjects.length} asignaturas`}
                    </p>
                  </div>
                  <div className={styles.toggles}>
                    <label className={styles.toggle}>
                      <input
                        checked={area.active}
                        disabled={Boolean(busy)}
                        onChange={(event) =>
                          updateArea(area, { active: event.target.checked })
                        }
                        type="checkbox"
                      />
                      Área activa
                    </label>
                    <label className={styles.toggle}>
                      <input
                        checked={area.included_in_final}
                        disabled={Boolean(busy)}
                        onChange={(event) =>
                          updateArea(area, {
                            included_in_final: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      Incluye en promedio
                    </label>
                    <label className={styles.toggle}>
                      Orden
                      <input
                        defaultValue={area.position}
                        disabled={Boolean(busy)}
                        min={1}
                        onBlur={(event) => {
                          const position = Number(event.target.value);
                          if (
                            Number.isInteger(position) &&
                            position > 0 &&
                            position !== area.position
                          ) {
                            void updateArea(area, { position });
                          }
                        }}
                        type="number"
                      />
                    </label>
                  </div>
                </header>

                <div className={styles.subjectList}>
                  {areaSubjects.map((subject) => (
                    <div className={styles.subjectRow} key={subject.id}>
                      <strong>{subject.name}</strong>
                      <label className={styles.toggle}>
                        <input
                          checked={subject.active}
                          disabled={Boolean(busy)}
                          onChange={(event) =>
                            updateSubject(subject, {
                              active: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        Activa
                      </label>
                      <label className={styles.toggle}>
                        Orden
                        <input
                          defaultValue={subject.position}
                          disabled={Boolean(busy)}
                          min={1}
                          onBlur={(event) => {
                            const position = Number(event.target.value);
                            if (
                              Number.isInteger(position) &&
                              position > 0 &&
                              position !== subject.position
                            ) {
                              void updateSubject(subject, { position });
                            }
                          }}
                          type="number"
                        />
                      </label>
                    </div>
                  ))}
                </div>

                {!area.is_direct ? (
                  <form
                    className={styles.addSubject}
                    onSubmit={(event) => addSubject(event, area)}
                  >
                    <input
                      aria-label={`Nueva asignatura de ${area.name}`}
                      maxLength={100}
                      name="name"
                      placeholder="Nueva asignatura"
                      required
                    />
                    <input
                      aria-label="Orden"
                      defaultValue={nextPosition}
                      min={1}
                      name="position"
                      required
                      type="number"
                    />
                    <button
                      className={styles.secondaryButton}
                      disabled={Boolean(busy)}
                      type="submit"
                    >
                      {busy === `add:${area.id}` ? "Agregando…" : "Agregar"}
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
