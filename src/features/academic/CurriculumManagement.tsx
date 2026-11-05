"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Alert, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useGroupWorkspace } from "@/features/groups/GroupWorkspace";
import styles from "./Academic.module.css";
import { curriculumNameSchema, customSubjectSchema } from "./schemas";

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
  const [editing, setEditing] = useState<{ key: string; name: string } | null>(null);
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");

  function sameName(left: string, right: string) {
    const normalized = (name: string) => name.trim()
      .normalize("NFD")
      .replaceAll(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es");
    return normalized(left) === normalized(right);
  }

  function validateName(name: string, siblings: { id: string; name: string }[], id?: string) {
    const parsed = curriculumNameSchema.safeParse(name);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Revisa el nombre.");
    if (siblings.some((item) => item.id !== id && sameName(item.name, parsed.data))) {
      throw new Error("Ya existe un elemento con ese nombre en este ámbito.");
    }
    return parsed.data;
  }

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
    changes: Partial<Pick<Area, "active" | "included_in_final" | "position" | "name">>,
  ) {
    setBusy(`area:${area.id}`);
    setError("");
    setMessage("");
    try {
      if (changes.name !== undefined) {
        changes.name = validateName(changes.name, areas, area.id);
      }
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
      if (updateError) {
        throw new Error(updateError.code === "23505"
          ? "Ya existe un área con ese nombre en este grupo."
          : updateError.message);
      }
      setAreas((current) =>
        current
          .map((item) => (item.id === area.id ? { ...item, ...changes } : item))
          .sort((a, b) => a.position - b.position),
      );
      setMessage("Malla actualizada correctamente.");
      if (changes.name !== undefined) setEditing(null);
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
    changes: Partial<Pick<Subject, "active" | "position" | "name">>,
  ) {
    setBusy(`subject:${subject.id}`);
    setError("");
    setMessage("");
    try {
      if (changes.name !== undefined) {
        changes.name = validateName(
          changes.name,
          subjects.filter((item) => item.group_area_id === subject.group_area_id),
          subject.id,
        );
      }
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
      if (updateError) {
        throw new Error(updateError.code === "23505"
          ? "Ya existe una asignatura con ese nombre en esta área."
          : updateError.message);
      }
      setSubjects((current) =>
        current
          .map((item) =>
            item.id === subject.id ? { ...item, ...changes } : item,
          )
          .sort((a, b) => a.position - b.position),
      );
      setMessage("Asignatura actualizada correctamente.");
      if (changes.name !== undefined) setEditing(null);
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
      const name = validateName(
        parsed.data.name,
        subjects.filter((subject) => subject.group_area_id === area.id),
      );
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("group_subjects")
        .insert({
          active: true,
          group_area_id: area.id,
          group_id: group.id,
          name,
          position: parsed.data.position,
        })
        .select("id, group_area_id, name, position, active")
        .single();
      if (insertError) {
        throw new Error(
          insertError.code === "23505"
            ? "Ya existe una asignatura con ese nombre en esta área."
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

  async function addArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("add-area");
    setError("");
    setMessage("");
    try {
      const name = validateName(newAreaName, areas);
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("group_areas")
        .insert({
          active: true,
          group_id: group.id,
          included_in_final: true,
          is_direct: false,
          name,
          position: Math.max(0, ...areas.map((area) => area.position)) + 10,
        })
        .select("id, name, position, active, included_in_final, is_direct")
        .single();
      if (insertError) {
        throw new Error(insertError.code === "23505"
          ? "Ya existe un área con ese nombre en este grupo."
          : insertError.message);
      }
      setAreas((current) => [...current, data as Area].sort((a, b) => a.position - b.position));
      setNewAreaName("");
      setShowAddArea(false);
      setMessage("Área agregada a este grupo. Ahora puedes añadir asignaturas.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo agregar el área.");
    } finally {
      setBusy("");
    }
  }

  async function deleteSubject(subject: Subject) {
    if (!window.confirm(`¿Eliminar la asignatura «${subject.name}»? Sus notas o boletas históricas impedirán el borrado. Puedes desactivarla en ese caso.`)) return;
    setBusy(`delete-subject:${subject.id}`);
    setError("");
    setMessage("");
    try {
      const { error: deleteError } = await createClient().rpc("delete_group_subject", {
        target_group_id: group.id,
        target_subject_id: subject.id,
      });
      if (deleteError) throw new Error(deleteError.message);
      setSubjects((current) => current.filter((item) => item.id !== subject.id));
      setMessage(`Se eliminó «${subject.name}» de este grupo.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la asignatura.");
    } finally {
      setBusy("");
    }
  }

  async function deleteArea(area: Area, areaSubjects: Subject[]) {
    const children = areaSubjects.length === 1 ? "1 asignatura" : `${areaSubjects.length} asignaturas`;
    if (!window.confirm(`¿Eliminar el área «${area.name}» y sus ${children}? Se bloqueará si hay notas o boletas históricas. Puedes desactivarla en ese caso.`)) return;
    setBusy(`delete-area:${area.id}`);
    setError("");
    setMessage("");
    try {
      const { error: deleteError } = await createClient().rpc("delete_group_area", {
        target_group_id: group.id,
        target_area_id: area.id,
      });
      if (deleteError) throw new Error(deleteError.message);
      setAreas((current) => current.filter((item) => item.id !== area.id));
      setSubjects((current) => current.filter((item) => item.group_area_id !== area.id));
      setMessage(`Se eliminó el área «${area.name}» y sus asignaturas de este grupo.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el área.");
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
            Organiza las áreas y asignaturas de este grupo. Los nombres se pueden
            cambiar sin perder notas; desactiva los elementos que tengan historial.
          </p>
        </div>
        <button
          className={styles.secondaryButton}
          disabled={Boolean(busy)}
          onClick={() => setShowAddArea((current) => !current)}
          type="button"
        >
          Agregar área
        </button>
      </header>

      {showAddArea ? (
        <form className={styles.addArea} onSubmit={addArea}>
          <label htmlFor="new-area-name">Nombre de la nueva área</label>
          <input
            autoFocus
            id="new-area-name"
            maxLength={100}
            onChange={(event) => setNewAreaName(event.target.value)}
            placeholder="Nueva área"
            required
            value={newAreaName}
          />
          <button className={styles.secondaryButton} disabled={Boolean(busy)} type="submit">
            {busy === "add-area" ? "Guardando…" : "Guardar área"}
          </button>
          <button className={styles.plainButton} onClick={() => setShowAddArea(false)} type="button">
            Cancelar
          </button>
        </form>
      ) : null}

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
          Este grupo todavía no tiene áreas. Usa «Agregar área» para comenzar.
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
                    {editing?.key === `area:${area.id}` ? (
                      <form
                        className={styles.renameForm}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void updateArea(area, { name: editing.name });
                        }}
                      >
                        <input
                          aria-label={`Nuevo nombre del área ${area.name}`}
                          autoFocus
                          maxLength={100}
                          onChange={(event) => setEditing({ key: editing.key, name: event.target.value })}
                          required
                          value={editing.name}
                        />
                        <button className={styles.secondaryButton} disabled={Boolean(busy)} type="submit">Guardar</button>
                        <button className={styles.plainButton} onClick={() => setEditing(null)} type="button">Cancelar</button>
                      </form>
                    ) : (
                      <h3>{area.name}</h3>
                    )}
                    <p className={styles.muted}>
                      {area.is_direct
                        ? "Área de nota directa"
                        : `${areaSubjects.length} asignaturas`}
                    </p>
                    <div className={styles.inlineActions}>
                      <button className={styles.plainButton} disabled={Boolean(busy)} onClick={() => setEditing({ key: `area:${area.id}`, name: area.name })} type="button">Editar nombre</button>
                      <button className={styles.deleteLink} disabled={Boolean(busy)} onClick={() => void deleteArea(area, areaSubjects)} type="button">Eliminar área</button>
                    </div>
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
                        key={`${area.id}:${area.position}`}
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
                      <div>
                        {editing?.key === `subject:${subject.id}` ? (
                          <form
                            className={styles.renameForm}
                            onSubmit={(event) => {
                              event.preventDefault();
                              void updateSubject(subject, { name: editing.name });
                            }}
                          >
                            <input
                              aria-label={`Nuevo nombre de la asignatura ${subject.name}`}
                              autoFocus
                              maxLength={100}
                              onChange={(event) => setEditing({ key: editing.key, name: event.target.value })}
                              required
                              value={editing.name}
                            />
                            <button className={styles.secondaryButton} disabled={Boolean(busy)} type="submit">Guardar</button>
                            <button className={styles.plainButton} onClick={() => setEditing(null)} type="button">Cancelar</button>
                          </form>
                        ) : <strong>{subject.name}</strong>}
                        <div className={styles.inlineActions}>
                          <button className={styles.plainButton} disabled={Boolean(busy)} onClick={() => setEditing({ key: `subject:${subject.id}`, name: subject.name })} type="button">Editar nombre</button>
                          <button className={styles.deleteLink} disabled={Boolean(busy)} onClick={() => void deleteSubject(subject)} type="button">Eliminar</button>
                        </div>
                      </div>
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
                          key={`${subject.id}:${subject.position}`}
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
                      {busy === `add:${area.id}` ? "Agregando…" : "Agregar asignatura"}
                    </button>
                  </form>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
