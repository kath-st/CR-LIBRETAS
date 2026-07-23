import {
  setTeacherStatusAction,
  setTemporaryPasswordAction,
  updateTeacherDetailsAction,
} from "@/features/admin/teacher-actions";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import styles from "../AdminPages.module.css";

export const metadata = {
  title: "Administrar docentes",
};

type SearchParams = Promise<{ error?: string; success?: string }>;

export default async function TeachersAdminPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  await requireAdmin();
  const messages = await searchParams;
  const supabase = await createClient();
  const { data: teachers } = await supabase
    .from("profiles")
    .select(
      "id, dni, nombres, apellidos, status, must_change_password, created_at",
    )
    .eq("role", "docente")
    .order("created_at", { ascending: false });

  return (
    <>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Accesos institucionales</p>
          <h1>Docentes</h1>
          <p>
            Revisa las solicitudes, corrige datos y administra la recuperación
            de acceso. Las cuentas con historial se desactivan, no se eliminan.
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

      {!teachers?.length ? (
        <p className={styles.empty}>Todavía no hay solicitudes docentes.</p>
      ) : (
        <section aria-label="Cuentas docentes" className={styles.grid}>
          {teachers.map((teacher) => {
            const badgeClass =
              teacher.status === "activo"
                ? styles.badgeActive
                : teacher.status === "pendiente"
                  ? styles.badgePending
                  : styles.badgeInactive;

            return (
              <article className={styles.item} key={teacher.id}>
                <header className={styles.itemHeader}>
                  <div>
                    <h2>
                      {teacher.nombres} {teacher.apellidos}
                    </h2>
                    <p>DNI {teacher.dni}</p>
                  </div>
                  <span className={`${styles.badge} ${badgeClass}`}>
                    {teacher.status}
                  </span>
                </header>

                <form
                  action={updateTeacherDetailsAction}
                  className={styles.form}
                >
                  <input name="id" type="hidden" value={teacher.id} />
                  <div className={styles.formGrid}>
                    <label>
                      Nombres
                      <input
                        defaultValue={teacher.nombres}
                        maxLength={80}
                        minLength={2}
                        name="nombres"
                        required
                      />
                    </label>
                    <label>
                      Apellidos
                      <input
                        defaultValue={teacher.apellidos}
                        maxLength={100}
                        minLength={2}
                        name="apellidos"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    DNI
                    <input
                      defaultValue={teacher.dni}
                      inputMode="numeric"
                      maxLength={8}
                      minLength={8}
                      name="dni"
                      pattern="[0-9]{8}"
                      required
                    />
                  </label>
                  <div className={styles.actions}>
                    <button className={styles.buttonSecondary} type="submit">
                      Guardar datos
                    </button>
                  </div>
                </form>

                <hr className={styles.divider} />

                <div className={styles.actions}>
                  <form action={setTeacherStatusAction}>
                    <input name="id" type="hidden" value={teacher.id} />
                    <input
                      name="status"
                      type="hidden"
                      value={teacher.status === "activo" ? "inactivo" : "activo"}
                    />
                    <button
                      className={
                        teacher.status === "activo"
                          ? styles.buttonDanger
                          : styles.button
                      }
                      type="submit"
                    >
                      {teacher.status === "pendiente"
                        ? "Aprobar cuenta"
                        : teacher.status === "activo"
                          ? "Desactivar"
                          : "Reactivar"}
                    </button>
                  </form>
                </div>

                {teacher.status !== "pendiente" ? (
                  <>
                    <hr className={styles.divider} />
                    <form
                      action={setTemporaryPasswordAction}
                      className={styles.form}
                    >
                      <input name="id" type="hidden" value={teacher.id} />
                      <label>
                        Contraseña temporal
                        <input
                          autoComplete="new-password"
                          minLength={8}
                          name="password"
                          placeholder="Mínimo 8 caracteres"
                          required
                          type="password"
                        />
                      </label>
                      <div className={styles.actions}>
                        <button className={styles.buttonSecondary} type="submit">
                          Asignar contraseña temporal
                        </button>
                        {teacher.must_change_password ? (
                          <span
                            className={`${styles.badge} ${styles.badgePending}`}
                          >
                            Cambio pendiente
                          </span>
                        ) : null}
                      </div>
                    </form>
                  </>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

