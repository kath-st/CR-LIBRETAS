"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Alert, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import styles from "@/features/academic/Academic.module.css";

type Group = {
  academic_year: number;
  active: boolean;
  display_name: string;
  grade: number;
  id: string;
  level: "primaria" | "secundaria";
  section: string;
};

const GroupContext = createContext<Group | null>(null);

export function useGroupWorkspace() {
  const group = useContext(GroupContext);
  if (!group) {
    throw new Error("La pantalla académica debe pertenecer a un grupo.");
  }
  return group;
}

export function GroupWorkspace({
  children,
  groupId,
}: Readonly<{ children: ReactNode; groupId: string }>) {
  const pathname = usePathname();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadGroup() {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("academic_groups")
        .select(
          "id, academic_year, level, grade, section, display_name, active",
        )
        .eq("id", groupId)
        .maybeSingle();

      if (!active) return;
      if (queryError || !data) {
        setError(
          queryError?.message ??
            "No tienes acceso a este grupo o el grupo no existe.",
        );
      } else {
        setGroup(data as Group);
      }
      setLoading(false);
    }

    void loadGroup();
    return () => {
      active = false;
    };
  }, [groupId]);

  if (loading) return <Spinner label="Abriendo grupo" />;

  if (error || !group) {
    return (
      <div className={styles.page}>
        <Alert title="Acceso al grupo denegado" tone="danger">
          <p>{error || "No se pudo abrir el grupo."}</p>
        </Alert>
        <div>
          <Link href="/grupos">Volver a mis grupos</Link>
        </div>
      </div>
    );
  }

  const base = `/grupos/${group.id}`;
  const tabs = [
    { href: base, label: "Resumen" },
    { href: `${base}/alumnos`, label: "Alumnos" },
    { href: `${base}/malla`, label: "Malla" },
    { href: `${base}/notas`, label: "Notas" },
    { href: `${base}/recomendaciones`, label: "Recomendaciones" },
    { href: `${base}/boletas`, label: "Boletas" },
    { href: `${base}/respaldos`, label: "Respaldos" },
  ];
  return (
    <GroupContext.Provider value={group}>
      <div className={styles.workspace}>
        <header className={styles.groupHeader}>
          <div className={styles.groupIdentity}>
            <div>
              <p className={styles.eyebrow}>Libreta seleccionada</p>
              <h1>{group.display_name}</h1>
              <p>
                {group.academic_year} ·{" "}
                {group.level === "primaria" ? "Primaria" : "Secundaria"} ·
                Sección {group.section}
              </p>
            </div>
            <span className={styles.status}>
              {group.active ? "Grupo activo" : "Grupo inactivo"}
            </span>
          </div>
          <nav aria-label="Módulos de la libreta" className={styles.tabs}>
            {tabs.map((tab) => (
              <Link
                className={pathname === tab.href ? styles.tabActive : ""}
                href={tab.href}
                key={tab.href}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </GroupContext.Provider>
  );
}
