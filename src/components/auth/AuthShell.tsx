import type { ReactNode } from "react";
import styles from "./AuthShell.module.css";

export function AuthShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-label="Acceso al sistema CR Libretas">
        <aside className={styles.brandPanel} aria-label="Identidad institucional">
          <div className={styles.glow} aria-hidden="true" />
          <div className={styles.brandContent}>
            <div className={styles.logoFrame}>
              <img
                className={styles.logo}
                src="/brand/escudo.png"
                alt="Escudo de la I.E.P. Cristo Redentor"
                width="148"
                height="148"
              />
            </div>
            <p className={styles.eyebrow}>I.E.P. Cristo Redentor de Nocheto</p>
            <h2>La información académica, clara y en un solo lugar.</h2>
            <p className={styles.description}>
              Un espacio institucional para organizar notas y preparar las boletas
              escolares con seguridad.
            </p>
          </div>
          <p className={styles.motto}>Dios, amor y disciplina</p>
        </aside>

        <section className={styles.formPanel}>
          <header className={styles.mobileBrand}>
            <img
              src="/brand/escudo.png"
              alt=""
              aria-hidden="true"
              width="56"
              height="56"
            />
            <div>
              <strong>CR Libretas</strong>
              <span>I.E.P. Cristo Redentor</span>
            </div>
          </header>
          <div className={styles.formWrap}>{children}</div>
          <p className={styles.phaseNote}>
            Acceso institucional protegido por Supabase Auth.
          </p>
        </section>
      </section>
    </main>
  );
}
