import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { logoutAction } from "@/features/auth/actions";
import {
  destinationFor,
  getAccessProfile,
} from "@/lib/auth/session";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Cuenta pendiente",
};

export default async function PendingAccountPage() {
  const profile = await getAccessProfile();
  if (profile && profile.status !== "pendiente") {
    redirect(destinationFor(profile));
  }

  return (
    <div className={styles.content}>
      <div className={styles.mark} aria-hidden="true">
        ✓
      </div>
      <p className={styles.eyebrow}>Estado de la solicitud</p>
      <h1>Solicitud enviada</h1>
      <p className={styles.lead}>
        {profile ? `${profile.nombres}, tu cuenta` : "Tu cuenta"} está pendiente
        de aprobación por la directora. Podrás ingresar cuando cambie a estado
        activo.
      </p>

      <Card className={styles.statusCard}>
        <span className={styles.dot} aria-hidden="true" />
        <div>
          <strong>Pendiente de aprobación</strong>
          <p>No necesitas enviar otra solicitud.</p>
        </div>
      </Card>

      {profile ? (
        <form action={logoutAction}>
          <Button fullWidth variant="secondary">
            Usar otra cuenta
          </Button>
        </form>
      ) : (
        <Link className={styles.back} href="/login">
          Volver al inicio de sesión
        </Link>
      )}
    </div>
  );
}
