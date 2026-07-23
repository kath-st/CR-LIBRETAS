import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/features/auth/actions";
import type { AccessProfile } from "@/lib/auth/session";
import styles from "./DashboardShell.module.css";

export function DashboardShell({
  children,
  profile,
}: Readonly<{ children: ReactNode; profile: AccessProfile }>) {
  const isAdmin = profile.role === "admin";

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
          <form action={logoutAction}>
            <button className={styles.logout} type="submit">
              Cerrar sesión
            </button>
          </form>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

