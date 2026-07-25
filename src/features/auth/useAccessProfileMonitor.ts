"use client";

import { useEffect, useState } from "react";
import {
  ACCESS_PROFILE_COLUMNS,
  ACCESS_PROFILE_STORAGE_KEY,
  accessProfileSchema,
  type AccessProfile,
} from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/client";

export function useAccessProfileMonitor(intervalMs = 4_000) {
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let checking = false;
    const supabase = createClient();

    async function checkProfile() {
      if (checking || !active) return;
      checking = true;

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
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
          throw new Error(
            profileError?.message ??
              "No se encontró el perfil asociado a la cuenta.",
          );
        }

        const parsed = accessProfileSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error("El perfil contiene datos no reconocidos.");
        }

        if (!active) return;
        window.sessionStorage.setItem(
          ACCESS_PROFILE_STORAGE_KEY,
          JSON.stringify(parsed.data),
        );
        setProfile(parsed.data);
        setError("");
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo consultar el estado de la cuenta.",
          );
        }
      } finally {
        checking = false;
        if (active) setLoading(false);
      }
    }

    void checkProfile();
    const interval = window.setInterval(checkProfile, intervalMs);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkProfile();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs]);

  return { error, loading, profile };
}
