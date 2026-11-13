"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ACCESS_PROFILE_STORAGE_KEY,
  type AccessProfile,
} from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/client";
import styles from "./DashboardShell.module.css";

export function DashboardShell({
  children,
  profile,
}: Readonly<{ children: ReactNode; profile: AccessProfile }>) {
  const isAdmin = profile.role === "admin";
  const [closing, setClosing] = useState(false);

  async function logout() {
    setClosing(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      window.sessionStorage.removeItem(ACCESS_PROFILE_STORAGE_KEY);
      window.location.replace("/login");
    }
  }

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href={isAdmin ? "/admin" : "/grupos"}>
          <img
            alt=""
            aria-hidden="true"
            height="52"
            src="/brand/escudo.png"
            width="52"
          />
          <span>
            <strong>CR Libretas</strong>
            <small>Cristo Redentor</small>
          </span>
        </Link>

        <nav aria-label="Navegación principal" className={styles.nav}>
          {isAdmin ? (
            <>
              <Link href="/admin">Resumen</Link>
              <Link href="/admin/docentes">Docentes</Link>
              <Link href="/admin/grupos">Grupos</Link>
            </>
          ) : (
            <Link href="/grupos">Mis grupos</Link>
          )}
        </nav>

        <p className={styles.motto}>Dios, amor y disciplina</p>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <span className={styles.role}>
              {isAdmin ? "Administración" : "Docente"}
            </span>
            <strong>
              {profile.nombres} {profile.apellidos}
            </strong>
          </div>
          <button
            className={styles.logout}
            disabled={closing}
            onClick={logout}
            type="button"
          >
            {closing ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
