import {
  createGroupAction,
  updateGroupAction,
} from "@/features/admin/group-actions";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../AdminPages.module.css";

export const metadata = {
  title: "Administrar grupos",
};

type SearchParams = Promise<{ error?: string; success?: string }>;

export default async function GroupsAdminPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  await requireAdmin();
  const messages = await searchParams;
  const supabase = await createClient();
  const [{ data: teachers }, { data: groups }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nombres, apellidos")
      .eq("role", "docente")
      .eq("status", "activo")
      .order("apellidos"),
    supabase
      .from("academic_groups")
      .select(
        "id, academic_year, level, grade, section, display_name, teacher_id, active",
      )
      .order("academic_year", { ascending: false })
      .order("level")
      .order("grade"),
  ]);
  const teacherById = new Map(
    teachers?.map((teacher) => [teacher.id, teacher]) ?? [],
  );

  return (
    <>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Organización académica</p>
          <h1>Grupos</h1>
          <p>
            Crea grados y secciones, y asigna una docente responsable. Inicial
            queda reservado para una ampliación futura.
          </p>
        </div>
      </header>

      {messages.success ? (
        <p className={`${styles.notice} ${styles.success}`} role="status">
          {messages.success}
        </p>
      ) : null}
      {messages.error ? (
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          {messages.error}
        </p>
      ) : null}

      <section className={styles.section}>
        <h2>Crear grupo</h2>
        <div className={styles.panel}>
          {!teachers?.length ? (
            <p className={styles.empty}>
              Primero debes aprobar al menos una cuenta docente.
            </p>
          ) : (
            <form action={createGroupAction} className={styles.form}>
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
                  <input max={6} min={1} name="grade" required type="number" />
                </label>
                <label>
                  Sección
                  <input defaultValue="Única" maxLength={30} name="section" required />
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
                <button className={styles.button} type="submit">
                  Crear y asignar grupo
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Grupos registrados</h2>
        {!groups?.length ? (
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

                  <form action={updateGroupAction} className={styles.form}>
                    <input name="id" type="hidden" value={group.id} />
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
                        <select defaultValue={group.level} name="level" required>
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
                        {teachers?.map((teacher) => (
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
                      <button className={styles.buttonSecondary} type="submit">
                        Guardar cambios
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

