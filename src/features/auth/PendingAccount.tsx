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

export function PendingAccount() {
  const [closing, setClosing] = useState(false);
  const { error, profile } = useAccessProfileMonitor();

  useEffect(() => {
    if (profile && profile.status !== "pendiente") {
      window.location.replace(destinationFor(profile));
    }
  }, [profile]);

  async function useAnotherAccount() {
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
        ✓
      </div>
      <p className={styles.eyebrow}>Estado de la solicitud</p>
      <h1>Solicitud enviada</h1>
      <p className={styles.lead}>
        {profile ? `${profile.nombres}, tu cuenta` : "Tu cuenta"} está pendiente
        de aprobación por la directora. Esta pantalla se actualizará
        automáticamente cuando sea aprobada.
      </p>

      {error ? (
        <Alert title="No se pudo actualizar el estado" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      <Card className={styles.statusCard}>
        <span className={styles.dot} aria-hidden="true" />
        <div>
          <strong>Pendiente de aprobación</strong>
          <p>No necesitas enviar otra solicitud.</p>
        </div>
      </Card>

      <Button
        fullWidth
        loading={closing}
        onClick={useAnotherAccount}
        variant="secondary"
      >
        Usar otra cuenta
      </Button>
    </div>
  );
}
