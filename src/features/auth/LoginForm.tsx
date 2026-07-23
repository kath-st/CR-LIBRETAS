"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Alert, Button, PasswordField, TextField } from "@/components/ui";
import { authErrorMessage, dniToInternalEmail } from "@/lib/auth/identity";
import type { AccessProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/client";
import { issuesByField, loginSchema } from "./schemas";
import styles from "./AuthForm.module.css";

type Errors = Partial<Record<"dni" | "password", string>>;

export function LoginForm() {
  const router = useRouter();
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
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: dniToInternalEmail(result.data.dni),
      password: result.data.password,
    });

    if (signInError) {
      setFormError(authErrorMessage(signInError.message));
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, dni, nombres, apellidos, role, status, must_change_password",
      )
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setFormError("No se encontró el perfil asociado a esta cuenta.");
      setLoading(false);
      return;
    }

    const access = profile as AccessProfile;
    if (access.status === "inactivo") {
      await supabase.auth.signOut();
      setFormError(
        "Esta cuenta está inactiva. Comunícate con la directora para solicitar acceso.",
      );
      setLoading(false);
      return;
    }

    const destination =
      access.status === "pendiente"
        ? "/cuenta-pendiente"
        : access.must_change_password
          ? "/cambiar-contrasena"
          : access.role === "admin"
            ? "/admin"
            : "/grupos";

    router.replace(destination);
    router.refresh();
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
          onChange={() => errors.dni && setErrors((value) => ({ ...value, dni: undefined }))}
          placeholder="8 dígitos"
          ref={dniRef}
        />
        <PasswordField
          autoComplete="current-password"
          error={errors.password}
          label="Contraseña"
          name="password"
          onChange={() =>
            errors.password &&
            setErrors((value) => ({ ...value, password: undefined }))
          }
          placeholder="Ingresa tu contraseña"
          ref={passwordRef}
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
