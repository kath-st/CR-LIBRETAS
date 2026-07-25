"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import {
  ACCESS_PROFILE_STORAGE_KEY,
  destinationFor,
} from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/client";
import { useAccessProfileMonitor } from "./useAccessProfileMonitor";
import styles from "@/app/(auth)/cuenta-pendiente/page.module.css";

export function InactiveAccount() {
  const [closing, setClosing] = useState(false);
  const { error, profile } = useAccessProfileMonitor();

  useEffect(() => {
    if (profile && profile.status !== "inactivo") {
      window.location.replace(destinationFor(profile));
    }
  }, [profile]);

  async function logout() {
    setClosing(true);
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } finally {
      window.sessionStorage.removeItem(ACCESS_PROFILE_STORAGE_KEY);
      window.location.replace("/login");
    }
  }

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

      {error ? (
        <Alert title="No se pudo actualizar el estado" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      <Card className={styles.statusCard}>
        <span className={styles.dot} aria-hidden="true" />
        <div>
          <strong>Acceso suspendido</strong>
          <p>Tu información y el historial académico no fueron eliminados.</p>
        </div>
      </Card>
      <Button
        fullWidth
        loading={closing}
        onClick={logout}
        variant="secondary"
      >
        Volver al inicio de sesión
      </Button>
    </div>
  );
}
