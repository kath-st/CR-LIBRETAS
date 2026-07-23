import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../admin/AdminPages.module.css";

export const metadata = {
  title: "Mis grupos",
};

export default async function MyGroupsPage() {
  const profile = await requireActiveUser();
  const supabase = await createClient();
  const { data: groups } = await supabase
    .from("academic_groups")
    .select("id, academic_year, level, grade, section, display_name, active")
    .eq("teacher_id", profile.id)
    .eq("active", true)
    .order("academic_year", { ascending: false })
    .order("grade");

  return (
    <>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Espacio docente</p>
          <h1>Mis grupos</h1>
          <p>
            Aquí aparecerán únicamente los grupos que la directora te haya
            asignado.
          </p>
        </div>
      </header>

      {!groups?.length ? (
        <p className={styles.empty}>
          Tu cuenta está activa, pero todavía no tienes grupos asignados.
        </p>
      ) : (
        <section aria-label="Grupos asignados" className={styles.grid}>
          {groups.map((group) => (
            <article className={styles.item} key={group.id}>
              <header className={styles.itemHeader}>
                <div>
                  <h2>{group.display_name}</h2>
                  <p>
                    {group.academic_year} ·{" "}
                    {group.level === "primaria" ? "Primaria" : "Secundaria"} ·{" "}
                    Sección {group.section}
                  </p>
                </div>
                <span className={`${styles.badge} ${styles.badgeActive}`}>
                  Activo
                </span>
              </header>
              <p>
                La gestión de alumnos, malla y notas se habilitará en las
                siguientes fases.
              </p>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

