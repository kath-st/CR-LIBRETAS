"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Alert, Button, Spinner } from "@/components/ui";
import {
  ACCESS_PROFILE_COLUMNS,
  ACCESS_PROFILE_STORAGE_KEY,
  accessProfileSchema,
  destinationFor,
  type AccessProfile,
} from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "./DashboardShell";
import styles from "./DashboardSessionBoundary.module.css";

function cachedProfile(): AccessProfile | null {
  try {
    const value = window.sessionStorage.getItem(ACCESS_PROFILE_STORAGE_KEY);
    if (!value) return null;
    const parsed = accessProfileSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function routeAllowed(pathname: string, profile: AccessProfile) {
  if (profile.role === "admin") {
    return pathname.startsWith("/admin") || pathname.startsWith("/grupos");
  }
  return pathname === "/grupos" || pathname.startsWith("/grupos/");
}

export function DashboardSessionBoundary({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const cached = cachedProfile();
    if (cached?.status === "activo" && !cached.must_change_password) {
      setProfile(cached);
    }

    async function validateSession() {
      try {
        const supabase = createClient();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user.id) {
          window.sessionStorage.removeItem(ACCESS_PROFILE_STORAGE_KEY);
          window.location.replace("/login");
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select(ACCESS_PROFILE_COLUMNS)
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileError || !data) {
          if (active) {
            setError(
              profileError
                ? `No se pudo consultar el perfil (${profileError.code || "sin código"}).`
                : "La cuenta autenticada no tiene un perfil asociado.",
            );
          }
          return;
        }

        const parsed = accessProfileSchema.safeParse(data);
        if (!parsed.success) {
          if (active) {
            const fields = parsed.error.issues
              .map((issue) => issue.path.join("."))
              .join(", ");
            setError(`El perfil tiene campos inválidos: ${fields}.`);
          }
          return;
        }

        const destination = destinationFor(parsed.data);
        if (destination !== "/admin" && destination !== "/grupos") {
          window.location.replace(destination);
          return;
        }

        window.sessionStorage.setItem(
          ACCESS_PROFILE_STORAGE_KEY,
          JSON.stringify(parsed.data),
        );
        if (active) {
          setError("");
          setProfile(parsed.data);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? `No se pudo validar la sesión: ${cause.message}`
              : "No se pudo validar la sesión.",
          );
        }
      }
    }

    void validateSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!profile || routeAllowed(pathname, profile)) return;
    window.location.replace(destinationFor(profile));
  }, [pathname, profile]);

  if (error) {
    return (
      <main className={styles.state}>
        <Alert title="No se pudo abrir el panel" tone="danger">
          <p>{error}</p>
        </Alert>
        <Button onClick={() => window.location.reload()}>
          Volver a intentar
        </Button>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className={styles.state}>
        <Spinner label="Validando sesión" />
        <p>Abriendo el panel…</p>
      </main>
    );
  }

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
