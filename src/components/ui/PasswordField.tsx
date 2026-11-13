"use client";

import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
} from "react";
import styles from "./Field.module.css";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  error?: string;
  hint?: string;
  label: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { error, hint, id, label, name, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const fieldId = id ?? name ?? generatedId;
    const messageId = `${fieldId}-message`;

    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={fieldId}>
          {label}
        </label>
        <div className={`${styles.control} ${error ? styles.invalid : ""}`}>
          <input
            aria-describedby={error || hint ? messageId : undefined}
            aria-invalid={Boolean(error)}
            className={styles.input}
            id={fieldId}
            name={name}
            ref={ref}
            type={visible ? "text" : "password"}
            {...props}
          />
          <button
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            className={styles.reveal}
            onClick={() => setVisible((current) => !current)}
            type="button"
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {error ? (
          <p className={styles.error} id={messageId}>
            {error}
          </p>
        ) : hint ? (
          <p className={styles.hint} id={messageId}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
