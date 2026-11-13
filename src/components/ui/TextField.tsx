import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./Field.module.css";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  hint?: string;
  label: string;
  leading?: ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { className = "", error, hint, id, label, leading, name, ...props },
    ref,
  ) {
    const generatedId = useId();
    const fieldId = id ?? name ?? generatedId;
    const messageId = `${fieldId}-message`;

    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={fieldId}>
          {label}
        </label>
        <div className={`${styles.control} ${error ? styles.invalid : ""}`}>
          {leading ? <span className={styles.leading}>{leading}</span> : null}
          <input
            aria-describedby={error || hint ? messageId : undefined}
            aria-invalid={Boolean(error)}
            className={`${styles.input} ${className}`}
            id={fieldId}
            name={name}
            ref={ref}
            {...props}
          />
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
