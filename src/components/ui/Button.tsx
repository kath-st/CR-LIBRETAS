import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";
import styles from "./Button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  children,
  className = "",
  disabled,
  fullWidth = false,
  loading = false,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <Spinner label="Procesando" size="small" /> : null}
      <span>{children}</span>
    </button>
  );
}
