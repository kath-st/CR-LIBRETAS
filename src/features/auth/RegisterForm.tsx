"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, PasswordField, TextField } from "@/components/ui";
import { Alert } from "@/components/ui";
import { authErrorMessage, dniToInternalEmail } from "@/lib/auth/identity";
import { createClient } from "@/lib/supabase/client";
import { issuesByField, registerSchema } from "./schemas";
import styles from "./AuthForm.module.css";

type Field =
  | "nombres"
  | "apellidos"
  | "dni"
  | "password"
  | "confirmation";
type Errors = Partial<Record<Field, string>>;

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const nombresRef = useRef<HTMLInputElement>(null);
  const apellidosRef = useRef<HTMLInputElement>(null);
  const dniRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  function clearError(field: Field) {
    setErrors((value) => ({ ...value, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    const result = registerSchema.safeParse({
      nombres: form.get("nombres"),
      apellidos: form.get("apellidos"),
      dni: form.get("dni"),
      password: form.get("password"),
      confirmation: form.get("confirmation"),
    });

    if (!result.success) {
      const nextErrors = issuesByField(result) as Errors;
      setErrors(nextErrors);
      const refs: Record<Field, React.RefObject<HTMLInputElement | null>> = {
        nombres: nombresRef,
        apellidos: apellidosRef,
        dni: dniRef,
        password: passwordRef,
        confirmation: confirmationRef,
      };
      const firstInvalid = (
        ["nombres", "apellidos", "dni", "password", "confirmation"] as Field[]
      ).find((field) => nextErrors[field]);
      if (firstInvalid) refs[firstInvalid].current?.focus();
      return;
    }

    setErrors({});
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: dniToInternalEmail(result.data.dni),
      password: result.data.password,
      options: {
        data: {
          dni: result.data.dni,
          nombres: result.data.nombres,
          apellidos: result.data.apellidos,
        },
      },
    });

    if (error) {
      setFormError(authErrorMessage(error.message));
      setLoading(false);
      return;
    }

    router.replace("/cuenta-pendiente");
    router.refresh();
  }

  return (
    <div>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Solicitud de acceso</p>
        <h1>Crear cuenta docente</h1>
        <p>Completa tus datos. La directora deberá aprobar la solicitud.</p>
      </div>

      {formError ? (
        <Alert title="No se pudo enviar la solicitud" tone="danger">
          <p>{formError}</p>
        </Alert>
      ) : null}

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <div className={styles.twoColumns}>
          <TextField
            autoComplete="given-name"
            error={errors.nombres}
            label="Nombres"
            name="nombres"
            onChange={() => clearError("nombres")}
            placeholder="Nombres"
            ref={nombresRef}
          />
          <TextField
            autoComplete="family-name"
            error={errors.apellidos}
            label="Apellidos"
            name="apellidos"
            onChange={() => clearError("apellidos")}
            placeholder="Apellidos"
            ref={apellidosRef}
          />
        </div>
        <TextField
          autoComplete="username"
          error={errors.dni}
          inputMode="numeric"
          label="DNI"
          maxLength={8}
          name="dni"
          onChange={() => clearError("dni")}
          placeholder="8 dígitos"
          ref={dniRef}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.password}
          hint="Usa 8 caracteres como mínimo."
          label="Contraseña"
          name="password"
          onChange={() => clearError("password")}
          placeholder="Crea una contraseña"
          ref={passwordRef}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.confirmation}
          label="Confirmar contraseña"
          name="confirmation"
          onChange={() => clearError("confirmation")}
          placeholder="Repite la contraseña"
          ref={confirmationRef}
        />
        <Button fullWidth loading={loading} type="submit">
          Solicitar cuenta
        </Button>
      </form>

      <p className={styles.switch}>
        ¿Ya tienes cuenta? <Link href="/login">Volver al inicio de sesión</Link>
      </p>
    </div>
  );
}
