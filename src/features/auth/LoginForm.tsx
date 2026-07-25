"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Alert, Button, PasswordField, TextField } from "@/components/ui";
import {
  ACCESS_PROFILE_COLUMNS,
  ACCESS_PROFILE_STORAGE_KEY,
  accessProfileSchema,
  destinationFor,
} from "@/lib/auth/access";
import {
  authErrorMessage,
  internalEmailsForDni,
} from "@/lib/auth/identity";
import { createClient } from "@/lib/supabase/client";
import { issuesByField, loginSchema } from "./schemas";
import styles from "./AuthForm.module.css";

type Errors = Partial<Record<"dni" | "password", string>>;

export function LoginForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const dniRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const form = new FormData(event.currentTarget);
    const result = loginSchema.safeParse({
      dni: form.get("dni"),
      password: form.get("password"),
    });

    if (!result.success) {
      const nextErrors = issuesByField(result) as Errors;
      setErrors(nextErrors);
      if (nextErrors.dni) dniRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const supabase = createClient();
      let signedInUserId: string | null = null;
      let signInError: {
        code?: string;
        message: string;
        status?: number;
      } | null = null;

      for (const email of internalEmailsForDni(result.data.dni)) {
        const attempt = await supabase.auth.signInWithPassword({
          email,
          password: result.data.password,
        });
        if (attempt.data.user) {
          signedInUserId = attempt.data.user.id;
          signInError = null;
          break;
        }

        signInError = attempt.error;
        const canTryLegacy =
          attempt.error?.code === "invalid_credentials" ||
          attempt.error?.message.toLowerCase().includes("invalid login");
        if (!canTryLegacy) break;
      }

      if (signInError || !signedInUserId) {
        console.error("[auth/login] Supabase rechazó el inicio de sesión", {
          code: signInError?.code,
          status: signInError?.status,
        });
        setFormError(
          signInError
            ? authErrorMessage(signInError.message, signInError.code)
            : "No se pudo iniciar la sesión. Inténtalo nuevamente.",
        );
        return;
      }

      const { data: rawProfile, error: profileError } = await supabase
        .from("profiles")
        .select(ACCESS_PROFILE_COLUMNS)
        .eq("id", signedInUserId)
        .maybeSingle();

      if (profileError || !rawProfile) {
        console.error("[auth/login] No se pudo cargar el perfil", {
          code: profileError?.code,
          hint: profileError?.hint,
          profileFound: Boolean(rawProfile),
        });
        setFormError(
          profileError
            ? "Supabase no permitió consultar el perfil. Revisa las políticas RLS de profiles."
            : "No se encontró el perfil asociado a esta cuenta.",
        );
        void supabase.auth.signOut({ scope: "local" });
        return;
      }

      const parsedProfile = accessProfileSchema.safeParse(rawProfile);
      if (!parsedProfile.success) {
        console.error("[auth/login] El perfil contiene valores no reconocidos", {
          fields: parsedProfile.error.issues.map((issue) =>
            issue.path.join("."),
          ),
        });
        setFormError(
          `El perfil contiene campos inválidos: ${parsedProfile.error.issues
            .map((issue) => issue.path.join("."))
            .join(", ")}.`,
        );
        void supabase.auth.signOut({ scope: "local" });
        return;
      }

      if (parsedProfile.data.status === "inactivo") {
        setFormError(
          "Esta cuenta está inactiva. Comunícate con la directora para solicitar acceso.",
        );
        void supabase.auth.signOut({ scope: "local" });
        return;
      }

      const destination = destinationFor(parsedProfile.data);
      window.sessionStorage.setItem(
        ACCESS_PROFILE_STORAGE_KEY,
        JSON.stringify(parsedProfile.data),
      );
      window.location.href = destination;
    } catch (error) {
      console.error("[auth/login] Fallo inesperado en el navegador", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      setFormError(
        "No se pudo conectar con Supabase. Verifica tu conexión e inténtalo nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Sistema de boletas</p>
        <h1>Bienvenida</h1>
        <p>Ingresa con tu DNI y contraseña institucional.</p>
      </div>

      {formError ? (
        <Alert title="No se pudo ingresar" tone="danger">
          <p>{formError}</p>
        </Alert>
      ) : null}

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <TextField
          autoComplete="username"
          error={errors.dni}
          inputMode="numeric"
          label="DNI"
          maxLength={8}
          name="dni"
          onChange={() =>
            errors.dni &&
            setErrors((current) => ({ ...current, dni: undefined }))
          }
          placeholder="8 dígitos"
          ref={dniRef}
          required
        />
        <PasswordField
          autoComplete="current-password"
          error={errors.password}
          label="Contraseña"
          name="password"
          onChange={() =>
            errors.password &&
            setErrors((current) => ({ ...current, password: undefined }))
          }
          placeholder="Ingresa tu contraseña"
          ref={passwordRef}
          required
        />
        <Button fullWidth loading={loading} type="submit">
          Ingresar
        </Button>
      </form>

      <p className={styles.switch}>
        ¿Aún no tienes una cuenta?{" "}
        <Link href="/registro">Crear cuenta docente</Link>
      </p>
    </div>
  );
}
