"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, PasswordField, Spinner } from "@/components/ui";
import {
  ACCESS_PROFILE_COLUMNS,
  ACCESS_PROFILE_STORAGE_KEY,
  accessProfileSchema,
  destinationFor,
} from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/client";
import { issuesByField, passwordChangeSchema } from "./schemas";
import { useAccessProfileMonitor } from "./useAccessProfileMonitor";
import styles from "./AuthForm.module.css";

type Errors = Partial<Record<"password" | "confirmation", string>>;

export function ChangePasswordForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    error: accessError,
    loading: checkingAccess,
    profile,
  } = useAccessProfileMonitor(60_000);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      profile &&
      (profile.status !== "activo" || !profile.must_change_password)
    ) {
      window.location.replace(destinationFor(profile));
    }
  }, [profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!profile?.must_change_password) {
      setFormError("La cuenta no requiere un cambio de contraseña.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const result = passwordChangeSchema.safeParse({
      password: form.get("password"),
      confirmation: form.get("confirmation"),
    });

    if (!result.success) {
      const nextErrors = issuesByField(result) as Errors;
      setErrors(nextErrors);
      if (nextErrors.password) passwordRef.current?.focus();
      else confirmationRef.current?.focus();
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: passwordError } = await supabase.auth.updateUser({
      password: result.data.password,
    });

    if (passwordError) {
      setFormError("No se pudo actualizar la contraseña. Inténtalo nuevamente.");
      setLoading(false);
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select(ACCESS_PROFILE_COLUMNS)
      .eq("id", profile.id)
      .maybeSingle();
    const parsed = accessProfileSchema.safeParse(data);

    if (profileError || !parsed.success) {
      setFormError(
        "La contraseña cambió, pero no se pudo actualizar el acceso. Vuelve a iniciar sesión.",
      );
      await supabase.auth.signOut();
      window.sessionStorage.removeItem(ACCESS_PROFILE_STORAGE_KEY);
      window.location.replace("/login");
      return;
    }

    window.sessionStorage.setItem(
      ACCESS_PROFILE_STORAGE_KEY,
      JSON.stringify(parsed.data),
    );
    window.location.replace(destinationFor(parsed.data));
  }

  if (checkingAccess && !profile) {
    return <Spinner label="Validando acceso" />;
  }

  return (
    <div>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Seguridad de la cuenta</p>
        <h1>Crea una nueva contraseña</h1>
        <p>
          La contraseña temporal solo sirve para este ingreso. Elige una que
          únicamente tú conozcas.
        </p>
      </div>

      {accessError ? (
        <Alert title="No se pudo validar la cuenta" tone="danger">
          <p>{accessError}</p>
        </Alert>
      ) : null}

      {formError ? (
        <Alert title="No se pudo guardar" tone="danger">
          <p>{formError}</p>
        </Alert>
      ) : null}

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <PasswordField
          autoComplete="new-password"
          error={errors.password}
          hint="Usa ocho caracteres como mínimo."
          label="Nueva contraseña"
          name="password"
          onChange={() =>
            errors.password &&
            setErrors((value) => ({ ...value, password: undefined }))
          }
          ref={passwordRef}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.confirmation}
          label="Confirmar contraseña"
          name="confirmation"
          onChange={() =>
            errors.confirmation &&
            setErrors((value) => ({ ...value, confirmation: undefined }))
          }
          ref={confirmationRef}
        />
        <Button
          disabled={!profile?.must_change_password}
          fullWidth
          loading={loading}
          type="submit"
        >
          Guardar nueva contraseña
        </Button>
      </form>
    </div>
  );
}
