"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Alert } from "@/components/ui";
import { useGroupWorkspace } from "@/features/groups/GroupWorkspace";
import {
  authenticatedFetch,
  readJsonResponse,
} from "@/lib/api/authenticated-fetch";
import styles from "@/features/academic/Academic.module.css";
import {
  parseStudentFile,
  type ExistingStudent,
  type ImportPreviewRow,
} from "./student-import";

type Props = {
  existingStudents: ExistingStudent[];
  onImported: () => Promise<void>;
};

export function StudentImport({ existingStudents, onImported }: Props) {
  const group = useGroupWorkspace();
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const summary = useMemo(
    () => ({
      duplicates: preview.filter((row) => row.duplicate).length,
      errors: preview.filter((row) => row.error).length,
      valid: preview.filter((row) => !row.error).length,
    }),
    [preview],
  );

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    setMessage("");
    setPreview([]);
    setSelected(new Set());
    if (!file) return;

    setBusy(true);
    setFileName(file.name);
    try {
      const rows = await parseStudentFile(file, existingStudents);
      setPreview(rows);
      setSelected(
        new Set(
          rows
            .filter((row) => !row.error && !row.duplicate)
            .map((row) => row.key),
        ),
      );
    } catch (cause) {
      setFileName("");
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo leer el archivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importSelected() {
    const rows = preview
      .filter((row) => selected.has(row.key) && !row.error)
      .map((row) => ({
        first_names: row.firstNames,
        last_names: row.lastNames,
      }));
    if (!rows.length) {
      setError("Selecciona al menos una fila válida.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedFetch(
        `/api/groups/${group.id}/students/import`,
        {
          body: JSON.stringify({ rows }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const result = await readJsonResponse<{ count: number }>(response);
      await onImported();
      setPreview([]);
      setSelected(new Set());
      setFileName("");
      setMessage(
        `${result.count} ${result.count === 1 ? "alumno importado" : "alumnos importados"} y matriculados correctamente.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo completar la importación.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.importHeading}>
        <div>
          <p className={styles.eyebrow}>Importación masiva</p>
          <h3>Importar desde XLSX o CSV</h3>
          <p className={styles.muted}>
            Usa «apellidos» y «nombres», o una columna
            «apellidos_y_nombres». Máximo 200 alumnos y 5 MB.
          </p>
        </div>
        <label className={styles.fileButton}>
          {busy && !preview.length ? "Leyendo…" : "Seleccionar archivo"}
          <input
            accept=".csv,.xls,.xlsx"
            disabled={busy}
            onChange={chooseFile}
            type="file"
          />
        </label>
      </div>

      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? (
        <Alert title="No se pudo importar" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      {preview.length ? (
        <div className={styles.importPreview}>
          <div className={styles.importSummary}>
            <div>
              <strong>{fileName}</strong>
              <span>{preview.length} filas detectadas</span>
            </div>
            <span className={styles.validCount}>
              {summary.valid} válidas
            </span>
            <span className={styles.duplicateCount}>
              {summary.duplicates} posibles duplicados
            </span>
            <span className={styles.errorCount}>
              {summary.errors} con error
            </span>
          </div>

          {summary.duplicates ? (
            <p className={styles.warning}>
              Los duplicados son solo una advertencia. Márcalos si realmente
              corresponden a alumnos diferentes.
            </p>
          ) : null}

          <div className={styles.importTableWrap}>
            <table className={styles.importTable}>
              <thead>
                <tr>
                  <th aria-label="Seleccionar">✓</th>
                  <th>Fila</th>
                  <th>Apellidos</th>
                  <th>Nombres</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <input
                        aria-label={`Seleccionar fila ${row.rowNumber}`}
                        checked={selected.has(row.key)}
                        disabled={Boolean(row.error) || busy}
                        onChange={(event) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(row.key);
                            else next.delete(row.key);
                            return next;
                          });
                        }}
                        type="checkbox"
                      />
                    </td>
                    <td>{row.rowNumber}</td>
                    <td>{row.lastNames || "—"}</td>
                    <td>{row.firstNames || "—"}</td>
                    <td>
                      {row.error ? (
                        <span className={styles.rowError}>{row.error}</span>
                      ) : row.duplicate ? (
                        <span className={styles.rowDuplicate}>
                          Posible duplicado
                        </span>
                      ) : (
                        <span className={styles.rowValid}>Válida</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.button}
              disabled={busy || !selected.size}
              onClick={importSelected}
              type="button"
            >
              {busy
                ? "Importando todo…"
                : `Importar ${selected.size} fila(s)`}
            </button>
            <button
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => {
                setPreview([]);
                setSelected(new Set());
                setFileName("");
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
