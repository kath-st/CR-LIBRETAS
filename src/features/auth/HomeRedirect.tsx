"use client";

import { useEffect } from "react";
import { Alert, Spinner } from "@/components/ui";
import { destinationFor } from "@/lib/auth/access";
import { useAccessProfileMonitor } from "./useAccessProfileMonitor";

export function HomeRedirect() {
  const { error, profile } = useAccessProfileMonitor(60_000);

  useEffect(() => {
    if (profile) window.location.replace(destinationFor(profile));
  }, [profile]);

  if (error) {
    return (
      <main>
        <Alert title="No se pudo abrir el sistema" tone="danger">
          <p>{error}</p>
        </Alert>
      </main>
    );
  }

  return (
    <main>
      <Spinner label="Abriendo el sistema" />
    </main>
  );
}
