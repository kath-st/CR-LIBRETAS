"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, PasswordField } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { issuesByField, passwordChangeSchema } from "./schemas";
import styles from "./AuthForm.module.css";

type Errors = Partial<Record<"password" | "confirmation", string>>;

export function ChangePasswordForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

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

    router.replace("/");
    router.refresh();
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
        <Button fullWidth loading={loading} type="submit">
          Guardar nueva contraseña
        </Button>
      </form>
    </div>
  );
}
