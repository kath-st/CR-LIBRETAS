import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "./AdminPages.module.css";

export const metadata = {
  title: "Administración",
};

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: teachers }, { data: groups }] = await Promise.all([
    supabase.from("profiles").select("status").eq("role", "docente"),
    supabase.from("academic_groups").select("id, active"),
  ]);

  const pending = teachers?.filter((item) => item.status === "pendiente").length ?? 0;
  const active = teachers?.filter((item) => item.status === "activo").length ?? 0;
  const activeGroups = groups?.filter((item) => item.active).length ?? 0;

  return (
    <>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Panel de la directora</p>
          <h1>Administración</h1>
          <p>
            Aprueba cuentas docentes y organiza los grupos académicos desde un
            solo lugar.
          </p>
        </div>
      </header>

      <section aria-label="Resumen administrativo" className={styles.stats}>
        <article className={styles.stat}>
          <span>Solicitudes pendientes</span>
          <strong>{pending}</strong>
        </article>
        <article className={styles.stat}>
          <span>Docentes activas</span>
          <strong>{active}</strong>
        </article>
        <article className={styles.stat}>
          <span>Grupos activos</span>
          <strong>{activeGroups}</strong>
        </article>
      </section>

      <section className={styles.quickLinks}>
        <Link className={styles.quickLink} href="/admin/docentes">
          <strong>Administrar docentes</strong>
          <span>Aprobar solicitudes, cambiar estados y recuperar accesos.</span>
        </Link>
        <Link className={styles.quickLink} href="/admin/grupos">
          <strong>Administrar grupos</strong>
          <span>Crear grados y secciones, y asignarlos a una docente.</span>
        </Link>
      </section>
    </>
  );
}

