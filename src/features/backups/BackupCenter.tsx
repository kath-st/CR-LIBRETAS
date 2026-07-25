"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Alert, Spinner } from "@/components/ui";
import { useGroupWorkspace } from "@/features/groups/GroupWorkspace";
import {
  authenticatedFetch,
  readJsonResponse,
} from "@/lib/api/authenticated-fetch";
import { createClient } from "@/lib/supabase/client";
import {
  backupDocumentSchema,
  type BackupDocument,
  type BackupSummary,
} from "./schema";
import styles from "./Backups.module.css";

type HistoryItem = {
  created_at: string;
  id: string;
  payload_sha256: string;
  reason: "antes_de_restaurar";
};

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function responseFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return encodedName ? decodeURIComponent(encodedName) : fallback;
}

export function BackupCenter() {
  const group = useGroupWorkspace();
  const [role, setRole] = useState<"admin" | "docente">("docente");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [backup, setBackup] = useState<BackupDocument | null>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"mismo" | "nuevo">("mismo");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const nextYear = Math.min(2100, group.academic_year + 1);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await authenticatedFetch(
        `/api/groups/${group.id}/backup/history`,
      );
      const data = await readJsonResponse<{ history: HistoryItem[] }>(response);
      setHistory(data.history);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar el historial.",
      );
    } finally {
      setLoadingHistory(false);
    }
  }, [group.id]);

  useEffect(() => {
    void loadHistory();
    const supabase = createClient();
    void supabase.auth.getSession().then(async ({ data }: {
      data: { session: { user: { id: string } } | null };
    }) => {
      if (!data.session) return;
      const profile = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profile.data?.role === "admin") setRole("admin");
    });
  }, [loadHistory]);

  async function downloadCurrent() {
    setBusy("export");
    setError("");
    setMessage("");
    try {
      const response = await authenticatedFetch(
        `/api/groups/${group.id}/backup`,
      );
      if (!response.ok) await readJsonResponse(response);
      downloadBlob(
        await response.blob(),
        responseFileName(response, `respaldo-${group.academic_year}.json`),
      );
      setMessage("Respaldo JSON generado y descargado correctamente.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo exportar el respaldo.",
      );
    } finally {
      setBusy("");
    }
  }

  async function downloadHistory(item: HistoryItem) {
    setBusy(item.id);
    setError("");
    try {
      const response = await authenticatedFetch(
        `/api/groups/${group.id}/backup/history/${item.id}`,
      );
      if (!response.ok) await readJsonResponse(response);
      downloadBlob(
        await response.blob(),
        responseFileName(response, "respaldo-automatico.json"),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo descargar el respaldo.",
      );
    } finally {
      setBusy("");
    }
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setBackup(null);
    setSummary(null);
    setConfirmation("");
    setError("");
    setMessage("");
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError("El respaldo supera el límite de 20 MB.");
      return;
    }

    setBusy("preview");
    setFileName(file.name);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const document = backupDocumentSchema.safeParse(raw);
      if (!document.success) {
        throw new Error(
          "El archivo no tiene la estructura de un respaldo de CR Libretas.",
        );
      }
      const response = await authenticatedFetch(
        `/api/groups/${group.id}/backup/preview`,
        {
          body: JSON.stringify({ backup: document.data }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const result = await readJsonResponse<{ summary: BackupSummary }>(
        response,
      );
      setBackup(document.data);
      setSummary(result.summary);
    } catch (cause) {
      setFileName("");
      setError(
        cause instanceof SyntaxError
          ? "El archivo JSON está dañado o incompleto."
          : cause instanceof Error
            ? cause.message
            : "No se pudo validar el respaldo.",
      );
    } finally {
      setBusy("");
    }
  }

  async function restore(form: FormData) {
    if (!backup || !summary) return;
    setBusy("restore");
    setError("");
    setMessage("");
    try {
      const body =
        mode === "mismo"
          ? { backup, confirmation, mode }
          : {
              backup,
              confirmation,
              mode,
              newGroup: {
                academicYear: Number(form.get("academicYear")),
                displayName: String(form.get("displayName") ?? ""),
                grade: Number(form.get("grade")),
                level: String(form.get("level")),
                section: String(form.get("section") ?? ""),
              },
            };
      const response = await authenticatedFetch(
        `/api/groups/${group.id}/backup/restore`,
        {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const result = await readJsonResponse<{ group_id: string }>(response);
      if (mode === "nuevo") {
        window.location.assign(`/grupos/${result.group_id}`);
        return;
      }
      setMessage(
        "Grupo restaurado completamente. Se guardó un respaldo automático del estado anterior.",
      );
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo restaurar el respaldo.",
      );
    } finally {
      setBusy("");
    }
  }

  const expectedConfirmation =
    mode === "mismo" ? "RESTAURAR" : "CREAR COPIA";

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Importación y respaldos</p>
          <h2>Seguridad de la libreta</h2>
          <p>
            Exporta el grupo completo y restaura respaldos verificados sin
            dejar datos parciales.
          </p>
        </div>
        <span className={styles.integrity}>Integridad SHA-256</span>
      </header>

      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? (
        <Alert title="No se pudo completar la operación" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardNumber}>1</div>
          <div>
            <h3>Exportar respaldo JSON</h3>
            <p>
              Incluye alumnos activos y retirados, matrículas, malla, notas,
              recomendaciones, resultados informativos y configuración.
            </p>
          </div>
          <button
            className={styles.primaryButton}
            disabled={Boolean(busy)}
            onClick={downloadCurrent}
            type="button"
          >
            {busy === "export" ? "Generando…" : "Descargar respaldo completo"}
          </button>
        </section>

        <section className={styles.card}>
          <div className={styles.cardNumber}>2</div>
          <div>
            <h3>Validar un respaldo</h3>
            <p>
              El contenido y su firma se comprueban antes de habilitar la
              restauración.
            </p>
          </div>
          <label className={styles.fileButton}>
            {busy === "preview" ? "Validando…" : "Seleccionar archivo JSON"}
            <input
              accept=".json,application/json"
              disabled={Boolean(busy)}
              onChange={chooseBackup}
              type="file"
            />
          </label>
        </section>
      </div>

      {backup && summary ? (
        <section className={styles.restorePanel}>
          <header>
            <div>
              <p className={styles.eyebrow}>Respaldo válido</p>
              <h3>{fileName}</h3>
              <p>
                {summary.source_group.display_name} ·{" "}
                {summary.source_group.academic_year}
              </p>
            </div>
            <span className={styles.validBadge}>Integridad verificada</span>
          </header>

          <div className={styles.stats}>
            <div>
              <span>Alumnos</span>
              <strong>{summary.students}</strong>
            </div>
            <div>
              <span>Activos / retirados</span>
              <strong>
                {summary.active_enrollments} / {summary.retired_enrollments}
              </strong>
            </div>
            <div>
              <span>Asignaturas</span>
              <strong>{summary.subjects}</strong>
            </div>
            <div>
              <span>Notas</span>
              <strong>{summary.grades}</strong>
            </div>
            <div>
              <span>Recomendaciones</span>
              <strong>{summary.recommendations}</strong>
            </div>
          </div>

          <form action={restore} className={styles.restoreForm}>
            <fieldset className={styles.modeSelector}>
              <legend>¿Dónde deseas restaurar?</legend>
              <label>
                <input
                  checked={mode === "mismo"}
                  name="mode"
                  onChange={() => {
                    setMode("mismo");
                    setConfirmation("");
                  }}
                  type="radio"
                />
                <span>
                  <strong>Sobre este grupo</strong>
                  <small>
                    Reemplaza los datos académicos y crea antes un respaldo
                    automático.
                  </small>
                </span>
              </label>
              {role === "admin" ? (
                <label>
                  <input
                    checked={mode === "nuevo"}
                    name="mode"
                    onChange={() => {
                      setMode("nuevo");
                      setConfirmation("");
                    }}
                    type="radio"
                  />
                  <span>
                    <strong>Crear otro grupo</strong>
                    <small>
                      Conserva este grupo y restaura los datos en una copia
                      nueva.
                    </small>
                  </span>
                </label>
              ) : null}
            </fieldset>

            {mode === "nuevo" ? (
              <div className={styles.newGroupFields}>
                <label>
                  Año académico
                  <input
                    defaultValue={nextYear}
                    max={2100}
                    min={2020}
                    name="academicYear"
                    required
                    type="number"
                  />
                </label>
                <label>
                  Nivel
                  <select defaultValue={group.level} name="level" required>
                    <option value="inicial">Inicial</option>
                    <option value="primaria">Primaria</option>
                    <option value="secundaria">Secundaria</option>
                  </select>
                </label>
                <label>
                  Grado
                  <input
                    defaultValue={group.grade}
                    max={6}
                    min={1}
                    name="grade"
                    required
                    type="number"
                  />
                </label>
                <label>
                  Sección
                  <input
                    defaultValue={group.section}
                    maxLength={30}
                    name="section"
                    required
                  />
                </label>
                <label className={styles.fullField}>
                  Nombre visible
                  <input
                    defaultValue={`${nextYear} - Copia de ${summary.source_group.display_name}`}
                    maxLength={120}
                    name="displayName"
                    required
                  />
                </label>
              </div>
            ) : null}

            <div className={styles.confirmation}>
              <label>
                Escribe <strong>{expectedConfirmation}</strong> para confirmar
                <input
                  autoComplete="off"
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={expectedConfirmation}
                  value={confirmation}
                />
              </label>
              <button
                className={styles.dangerButton}
                disabled={
                  busy === "restore" ||
                  confirmation !== expectedConfirmation
                }
                type="submit"
              >
                {busy === "restore"
                  ? "Restaurando todo…"
                  : mode === "mismo"
                    ? "Restaurar este grupo"
                    : "Crear y restaurar copia"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={styles.history}>
        <header>
          <div>
            <p className={styles.eyebrow}>Protección automática</p>
            <h3>Historial previo a restauraciones</h3>
          </div>
          <button
            className={styles.textButton}
            disabled={loadingHistory}
            onClick={loadHistory}
            type="button"
          >
            Actualizar
          </button>
        </header>
        {loadingHistory ? (
          <Spinner label="Cargando respaldos automáticos" />
        ) : !history.length ? (
          <p className={styles.empty}>
            Aún no se ha reemplazado este grupo. El primer respaldo automático
            aparecerá antes de una restauración.
          </p>
        ) : (
          <div className={styles.historyList}>
            {history.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>Estado anterior a restauración</strong>
                  <span>
                    {new Intl.DateTimeFormat("es-PE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.created_at))}
                  </span>
                  <small>SHA-256 {item.payload_sha256.slice(0, 16)}…</small>
                </div>
                <button
                  className={styles.secondaryButton}
                  disabled={Boolean(busy)}
                  onClick={() => downloadHistory(item)}
                  type="button"
                >
                  {busy === item.id ? "Descargando…" : "Descargar"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
