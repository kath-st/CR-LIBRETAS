"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/(dashboard)/admin/AdminPages.module.css";

type Group = {
  academic_year: number;
  active: boolean;
  display_name: string;
  grade: number;
  id: string;
  level: "primaria" | "secundaria";
  section: string;
};

export function MyGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadGroups() {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("academic_groups")
        .select(
          "id, academic_year, level, grade, section, display_name, active",
        )
        .eq("active", true)
        .order("academic_year", { ascending: false })
        .order("grade");

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setGroups((data ?? []) as Group[]);
      setLoading(false);
    }

    void loadGroups();
    return () => {
      active = false;
    };
  }, []);

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

      {error ? (
        <Alert title="No se pudieron cargar los grupos" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : loading ? (
        <Spinner label="Cargando grupos" />
      ) : !groups.length ? (
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
                    {group.level === "primaria"
                      ? "Primaria"
                      : "Secundaria"}{" "}
                    · Sección {group.section}
                  </p>
                </div>
                <span className={`${styles.badge} ${styles.badgeActive}`}>
                  Activo
                </span>
              </header>
              <p>
                Administra alumnos, malla, notas, cálculos y recomendaciones de
                esta libreta.
              </p>
              <Link
                className={styles.button}
                href={`/grupos/${group.id}`}
              >
                Trabajar libreta
              </Link>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
