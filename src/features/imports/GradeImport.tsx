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
  parseGradeImportFile,
  type ParsedGradeImportRow,
} from "./grade-import";

type ImportScope = "current" | "multiple";
type ImportPolicy = "fill_empty" | "replace_terms" | "update";

type PreviewRow = {
  changes: string;
  error: string;
  group: string;
  key: string;
  newStudent: boolean;
  overwriteCount: number;
  rowNumber: number;
  sheet: string;
  skippedCount: number;
  student: string;
  subject: string;
  warning: string;
};

type PreviewResponse = {
  rows: PreviewRow[];
  summary: {
    clears: number;
    errors: number;
    gradeChanges: number;
    groups: number;
    newStudents: number;
    overwrites: number;
    rows: number;
    skipped: number;
    valid: number;
  };
};

type CommitResponse = {
  result: {
    affected_rows: number;
    backups_created: number;
    requested_changes: number;
    students_created: number;
  };
  summary: PreviewResponse["summary"];
};

function downloadName(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (!encoded) return fallback;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return fallback;
  }
}

export function GradeImport({
  onBeforeImport,
  onImported,
}: {
  onBeforeImport: () => Promise<void>;
  onImported: () => Promise<void>;
}) {
  const group = useGroupWorkspace();
  const [scope, setScope] = useState<ImportScope>("current");
  const [policy, setPolicy] = useState<ImportPolicy>("update");
  const [createMissingStudents, setCreateMissingStudents] = useState(true);
  const [sourceRows, setSourceRows] = useState<ParsedGradeImportRow[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const displayedRows = useMemo(() => preview?.rows.slice(0, 500) ?? [], [preview]);

  function settingsChanged() {
    setPreview(null);
    setSelected(new Set());
    setError("");
    setMessage("");
  }

  async function requestPreview(rows: ParsedGradeImportRow[]) {
    const response = await authenticatedFetch("/api/grades/import", {
      body: JSON.stringify({
        createMissingStudents,
        currentGroupId: group.id,
        mode: "preview",
        policy,
        rows,
        scope,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = await readJsonResponse<PreviewResponse>(response);
    setPreview(result);
    setSelected(
      new Set(result.rows.filter((row) => !row.error).map((row) => row.key)),
    );
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    setSelected(new Set());
    setFileName(file.name);
    try {
      const rows = await parseGradeImportFile(file);
      setSourceRows(rows);
      await requestPreview(rows);
    } catch (cause) {
      setSourceRows([]);
      setFileName("");
      setError(
        cause instanceof Error ? cause.message : "No se pudo leer el archivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function refreshPreview() {
    if (!sourceRows.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await requestPreview(sourceRows);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo analizar el archivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate(templateScope: "all" | "current") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedFetch(
        `/api/grades/import/template?scope=${templateScope}&groupId=${group.id}`,
      );
      if (!response.ok) await readJsonResponse(response);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName(response, "plantilla-notas.xlsx");
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo descargar la plantilla.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importSelected() {
    const rows = sourceRows.filter((row) => selected.has(row.key));
    if (!rows.length) {
      setError("Selecciona al menos una fila válida.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onBeforeImport();
      const response = await authenticatedFetch("/api/grades/import", {
        body: JSON.stringify({
          createMissingStudents,
          currentGroupId: group.id,
          mode: "commit",
          policy,
          rows,
          scope,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await readJsonResponse<CommitResponse>(response);
      await onImported();
      setSourceRows([]);
      setPreview(null);
      setSelected(new Set());
      setFileName("");
      setMessage(
        `${result.result.requested_changes} cambio(s) procesados en ${result.summary.groups} grupo(s). ` +
          `${result.result.students_created} alumno(s) nuevo(s) y ${result.result.backups_created} respaldo(s) creados.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo importar las notas.",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetImport() {
    setSourceRows([]);
    setPreview(null);
    setSelected(new Set());
    setFileName("");
    setError("");
  }

  return (
    <section className={`${styles.panel} ${styles.gradeImportPanel}`}>
      <div className={styles.importHeading}>
        <div>
          <p className={styles.eyebrow}>Carga masiva</p>
          <h3>Importar notas desde Excel o CSV</h3>
          <p className={styles.muted}>
            Usa una fila por alumno y asignatura. Puedes completar el grupo actual
            o varios grupos autorizados en una sola operación.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            disabled={busy}
            onClick={() => void downloadTemplate("current")}
            type="button"
          >
            Plantilla de este grupo
          </button>
          <button
            className={styles.secondaryButton}
            disabled={busy}
            onClick={() => void downloadTemplate("all")}
            type="button"
          >
            Plantilla de varios grupos
          </button>
        </div>
      </div>

      <div className={styles.importOptions}>
        <label className={styles.field}>
          Alcance
          <select
            disabled={busy}
            onChange={(event) => {
              setScope(event.target.value as ImportScope);
              settingsChanged();
            }}
            value={scope}
          >
            <option value="current">Solo el grupo actual</option>
            <option value="multiple">Varios grupos autorizados</option>
          </select>
        </label>
        <label className={styles.field}>
          Tratamiento de notas existentes
          <select
            disabled={busy}
            onChange={(event) => {
              setPolicy(event.target.value as ImportPolicy);
              settingsChanged();
            }}
            value={policy}
          >
            <option value="update">Actualizar las celdas del archivo</option>
            <option value="fill_empty">Completar solo celdas vacías</option>
            <option value="replace_terms">Reemplazar los bimestres incluidos</option>
          </select>
        </label>
        <label className={styles.importCheckbox}>
          <input
            checked={createMissingStudents}
            disabled={busy}
            onChange={(event) => {
              setCreateMissingStudents(event.target.checked);
              settingsChanged();
            }}
            type="checkbox"
          />
          Crear y matricular alumnos que no existan
        </label>
        <label className={styles.fileButton}>
          {busy ? "Procesando…" : "Seleccionar archivo"}
          <input
            accept=".csv,.xls,.xlsx"
            disabled={busy}
            onChange={chooseFile}
            type="file"
          />
        </label>
      </div>

      {policy === "replace_terms" ? (
        <p className={styles.warning}>
          Esta opción limpiará todas las notas de cada grupo y bimestre incluido
          antes de aplicar el archivo. Se generará un respaldo automático.
        </p>
      ) : null}
      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? (
        <Alert title="No se pudo importar" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      {sourceRows.length && !preview ? (
        <div className={styles.actions}>
          <span className={styles.muted}>
            {fileName} · la configuración cambió
          </span>
          <button
            className={styles.button}
            disabled={busy}
            onClick={() => void refreshPreview()}
            type="button"
          >
            Actualizar vista previa
          </button>
        </div>
      ) : null}

      {preview ? (
        <div className={styles.importPreview}>
          <div className={styles.importSummary}>
            <div>
              <strong>{fileName}</strong>
              <span>
                {preview.summary.rows} filas · {preview.summary.gradeChanges} cambios · {preview.summary.groups} grupo(s)
              </span>
            </div>
            <span className={styles.validCount}>{preview.summary.valid} válidas</span>
            <span className={styles.duplicateCount}>
              {preview.summary.newStudents} alumnos nuevos
            </span>
            <span className={styles.duplicateCount}>
              {preview.summary.overwrites} reemplazos
            </span>
            <span className={styles.errorCount}>{preview.summary.errors} con error</span>
          </div>

          <div className={styles.importSelectionBar}>
            <button
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() =>
                setSelected(
                  new Set(preview.rows.filter((row) => !row.error).map((row) => row.key)),
                )
              }
              type="button"
            >
              Seleccionar válidas
            </button>
            <button
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => setSelected(new Set())}
              type="button"
            >
              Quitar selección
            </button>
            <span className={styles.muted}>{selected.size} fila(s) seleccionada(s)</span>
          </div>

          <div className={styles.importTableWrap}>
            <table className={`${styles.importTable} ${styles.gradeImportTable}`}>
              <thead>
                <tr>
                  <th aria-label="Seleccionar">✓</th>
                  <th>Origen</th>
                  <th>Grupo</th>
                  <th>Alumno</th>
                  <th>Asignatura</th>
                  <th>Cambios</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <input
                        aria-label={`Seleccionar ${row.sheet}, fila ${row.rowNumber}`}
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
                    <td>{row.sheet} · {row.rowNumber}</td>
                    <td>{row.group}</td>
                    <td>{row.student}</td>
                    <td>{row.subject}</td>
                    <td>{row.changes}</td>
                    <td>
                      {row.error ? (
                        <span className={styles.rowError}>{row.error}</span>
                      ) : row.warning ? (
                        <span className={styles.rowDuplicate}>{row.warning}</span>
                      ) : (
                        <span className={styles.rowValid}>Lista para importar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > displayedRows.length ? (
            <p className={styles.muted}>
              La tabla muestra las primeras {displayedRows.length} filas; la selección
              y la importación incluyen todas las filas elegidas.
            </p>
          ) : null}

          <div className={styles.actions}>
            <button
              className={styles.button}
              disabled={busy || !selected.size}
              onClick={() => void importSelected()}
              type="button"
            >
              {busy ? "Importando…" : `Importar ${selected.size} fila(s)`}
            </button>
            <button
              className={styles.secondaryButton}
              disabled={busy}
              onClick={resetImport}
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
