import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { logoutAction } from "@/features/auth/actions";
import { destinationFor, getAccessProfile } from "@/lib/auth/session";
import styles from "../cuenta-pendiente/page.module.css";

export const metadata: Metadata = {
  title: "Cuenta inactiva",
};

export default async function InactiveAccountPage() {
  const profile = await getAccessProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "inactivo") redirect(destinationFor(profile));

  return (
    <div className={styles.content}>
      <div className={styles.mark} aria-hidden="true">
        !
      </div>
      <p className={styles.eyebrow}>Acceso institucional</p>
      <h1>Cuenta inactiva</h1>
      <p className={styles.lead}>
        Tu cuenta no puede acceder al sistema en este momento. Comunícate con la
        directora si necesitas solicitar la reactivación.
      </p>
      <Card className={styles.statusCard}>
        <span className={styles.dot} aria-hidden="true" />
        <div>
          <strong>Acceso suspendido</strong>
          <p>Tu información y el historial académico no fueron eliminados.</p>
        </div>
      </Card>
      <form action={logoutAction}>
        <Button fullWidth variant="secondary">
          Volver al inicio de sesión
        </Button>
      </form>
    </div>
  );
}

