import type { ReactNode } from "react";
import styles from "./Alert.module.css";

export function Alert({
  children,
  title,
  tone = "info",
}: Readonly<{
  children: ReactNode;
  title?: string;
  tone?: "danger" | "info" | "success";
}>) {
  return (
    <div
      className={`${styles.alert} ${styles[tone]}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}
