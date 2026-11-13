"use client";

import { useEffect, useId, type ReactNode } from "react";
import { Button } from "./Button";
import styles from "./Modal.module.css";

export function Modal({
  children,
  onClose,
  open,
  title,
}: Readonly<{
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}>) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <Button aria-label="Cerrar ventana" onClick={onClose} variant="ghost">
            Cerrar
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}
