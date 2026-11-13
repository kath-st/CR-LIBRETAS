import styles from "./Spinner.module.css";

export function Spinner({
  label = "Cargando",
  size = "medium",
}: Readonly<{ label?: string; size?: "small" | "medium" }>) {
  return (
    <span className={styles.wrapper} role="status">
      <span className={`${styles.spinner} ${styles[size]}`} aria-hidden="true" />
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}
