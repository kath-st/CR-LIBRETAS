"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/(dashboard)/admin/AdminPages.module.css";

type Summary = {
  activeGroups: number;
  activeTeachers: number;
  pendingTeachers: number;
};

type TeacherStatus = { status: string };
type GroupStatus = { active: boolean };

const initialSummary: Summary = {
  activeGroups: 0,
  activeTeachers: 0,
  pendingTeachers: 0,
};

export function AdminOverview() {
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      const supabase = createClient();
      const [
        { data: teachers, error: teachersError },
        { data: groups, error: groupsError },
      ] = await Promise.all([
        supabase.from("profiles").select("status").eq("role", "docente"),
        supabase.from("academic_groups").select("id, active"),
      ]);

      if (!active) return;
      if (teachersError || groupsError) {
        setError(
          teachersError?.message ??
            groupsError?.message ??
            "No se pudo cargar el resumen.",
        );
        setLoading(false);
        return;
      }

      const teacherRows = (teachers ?? []) as TeacherStatus[];
      const groupRows = (groups ?? []) as GroupStatus[];
      setSummary({
        activeGroups: groupRows.filter((item) => item.active).length,
        activeTeachers: teacherRows.filter(
          (item) => item.status === "activo",
        ).length,
        pendingTeachers: teacherRows.filter(
          (item) => item.status === "pendiente",
        ).length,
      });
      setLoading(false);
    }

    void loadSummary();
    return () => {
      active = false;
    };
  }, []);

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

      {error ? (
        <Alert title="No se pudo cargar el resumen" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      <section aria-label="Resumen administrativo" className={styles.stats}>
        <article className={styles.stat}>
          <span>Solicitudes pendientes</span>
          <strong>{loading ? "…" : summary.pendingTeachers}</strong>
        </article>
        <article className={styles.stat}>
          <span>Docentes activas</span>
          <strong>{loading ? "…" : summary.activeTeachers}</strong>
        </article>
        <article className={styles.stat}>
          <span>Grupos activos</span>
          <strong>{loading ? "…" : summary.activeGroups}</strong>
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
