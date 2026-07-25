"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Spinner } from "@/components/ui";
import { useGroupWorkspace } from "@/features/groups/GroupWorkspace";
import { createClient } from "@/lib/supabase/client";
import styles from "./ReportCards.module.css";
import type { ReportScope } from "./types";

type Student = {
  enrollmentId: string;
  name: string;
  studentId: string;
};

type Generation = {
  byte_size: number;
  content_sha256: string;
  created_at: string;
  file_name: string;
  id: string;
  scope: ReportScope;
  student_count: number;
};

async function responseData<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
    requestId?: string;
  };
  if (!response.ok) {
    const message =
      data.message ||
      data.error ||
      `No se pudo completar la operación (${response.status}).`;
    throw new Error(
      data.requestId ? `${message} Referencia: ${data.requestId}` : message,
    );
  }
  return data;
}

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const supabase = createClient();
  const {
    data: { session: currentSession },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !currentSession) {
    throw new Error("La sesión expiró. Vuelve a iniciar sesión.");
  }

  function send(accessToken: string) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(input, {
      ...init,
      cache: "no-store",
      headers,
    });
  }

  let session = currentSession;
  let response = await send(session.access_token);
  if (response.status === 401) {
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedSession) {
      throw new Error("La sesión expiró. Vuelve a iniciar sesión.");
    }
    session = refreshedSession;
    response = await send(session.access_token);
  }

  return { accessToken: session.access_token, response };
}

function scopeLabel(scope: ReportScope) {
  return {
    grupo: "Grupo completo",
    individual: "Individual",
    seleccion: "Selección",
  }[scope];
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ReportCards() {
  const group = useGroupWorkspace();
  const [students, setStudents] = useState<Student[]>([]);
  const [history, setHistory] = useState<Generation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const baseUrl = `/api/groups/${group.id}/report-cards`;

  const loadPreview = useCallback(
    async (enrollmentId: string) => {
      setPreviewLoading(true);
      setError("");
      try {
        const { response } = await authenticatedFetch(`${baseUrl}/preview`, {
          body: JSON.stringify({ enrollmentId }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const data = await responseData<{ html: string }>(response);
        setPreviewHtml(data.html);
      } catch (cause) {
        setPreviewHtml("");
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo preparar la vista previa.",
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [baseUrl],
  );

  const loadPage = useCallback(async () => {
    setLoading(true);
    setPageLoaded(false);
    setError("");
    try {
      const { response } = await authenticatedFetch(baseUrl);
      const data = await responseData<{
        history: Generation[];
        students: Student[];
      }>(response);
      setStudents(data.students);
      setHistory(data.history);
      setPageLoaded(true);
      const firstId = data.students[0]?.enrollmentId ?? "";
      setPreviewId((current) => current || firstId);
      if (firstId) await loadPreview(firstId);
    } catch (cause) {
      setStudents([]);
      setHistory([]);
      setPreviewHtml("");
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo abrir el módulo de boletas.",
      );
    } finally {
      setLoading(false);
    }
  }, [baseUrl, loadPreview]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function download(generationId: string, fallbackName?: string) {
    const { response } = await authenticatedFetch(
      `${baseUrl}/${generationId}`,
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(data.error || "No se pudo descargar el PDF.");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const fileName = encodedName
      ? decodeURIComponent(encodedName)
      : fallbackName || "boletas.pdf";
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  async function generate(scope: ReportScope, enrollmentIds?: string[]) {
    const key = `${scope}:${enrollmentIds?.join(",") ?? "all"}`;
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const { response } = await authenticatedFetch(baseUrl, {
        body: JSON.stringify({
          ...(scope === "grupo" ? {} : { enrollmentIds }),
          scope,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = await responseData<{
        createdAt: string;
        fileName: string;
        generationId: string;
        pages: number;
      }>(response);
      setMessage(
        `PDF creado y guardado: ${data.pages} ${data.pages === 1 ? "página" : "páginas"}.`,
      );
      await download(data.generationId, data.fileName);
      await loadPage();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo generar el PDF.",
      );
    } finally {
      setBusy("");
    }
  }

  const selectedIds = useMemo(() => [...selected], [selected]);
  const allSelected =
    students.length > 0 && selected.size === students.length;

  if (loading) return <Spinner label="Cargando módulo de boletas" />;

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Documentos oficiales</p>
          <h2>Boletas de notas</h2>
          <p>
            Revisa la hoja A4 y genera PDFs privados con una página por alumno.
          </p>
        </div>
        <span className={styles.immutable}>Historial inmutable</span>
      </header>

      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? (
        <Alert title="No se pudo completar la operación" tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}

      {!pageLoaded ? (
        <div className={styles.empty}>
          <p>No se pudieron cargar los datos de las boletas.</p>
          <button
            className={styles.secondaryButton}
            onClick={() => loadPage()}
            type="button"
          >
            Intentar nuevamente
          </button>
        </div>
      ) : !students.length ? (
        <p className={styles.empty}>
          Registra al menos un alumno activo antes de generar boletas.
        </p>
      ) : (
        <>
          <div className={styles.layout}>
            <aside className={styles.controls}>
              <section className={styles.panel}>
                <h3>Vista previa</h3>
                <label>
                  Alumno
                  <select
                    onChange={(event) => {
                      const enrollmentId = event.target.value;
                      setPreviewId(enrollmentId);
                      void loadPreview(enrollmentId);
                    }}
                    value={previewId}
                  >
                    {students.map((student) => (
                      <option
                        key={student.enrollmentId}
                        value={student.enrollmentId}
                      >
                        {student.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={styles.primaryButton}
                  disabled={Boolean(busy) || !previewId}
                  onClick={() => generate("individual", [previewId])}
                  type="button"
                >
                  {busy.startsWith("individual")
                    ? "Generando…"
                    : "Descargar PDF individual"}
                </button>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h3>Selección</h3>
                    <p>{selected.size} alumno(s)</p>
                  </div>
                  <button
                    className={styles.textButton}
                    onClick={() =>
                      setSelected(
                        allSelected
                          ? new Set()
                          : new Set(
                              students.map((student) => student.enrollmentId),
                            ),
                      )
                    }
                    type="button"
                  >
                    {allSelected ? "Limpiar" : "Todos"}
                  </button>
                </div>
                <div className={styles.studentList}>
                  {students.map((student) => (
                    <label key={student.enrollmentId}>
                      <input
                        checked={selected.has(student.enrollmentId)}
                        onChange={(event) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) {
                              next.add(student.enrollmentId);
                            } else {
                              next.delete(student.enrollmentId);
                            }
                            return next;
                          });
                        }}
                        type="checkbox"
                      />
                      <span>{student.name}</span>
                    </label>
                  ))}
                </div>
                <button
                  className={styles.secondaryButton}
                  disabled={Boolean(busy) || !selectedIds.length}
                  onClick={() => generate("seleccion", selectedIds)}
                  type="button"
                >
                  {busy.startsWith("seleccion")
                    ? "Generando selección…"
                    : "PDF de la selección"}
                </button>
                <button
                  className={styles.primaryButton}
                  disabled={Boolean(busy)}
                  onClick={() => generate("grupo")}
                  type="button"
                >
                  {busy.startsWith("grupo")
                    ? "Generando grupo…"
                    : `PDF del grupo completo (${students.length})`}
                </button>
              </section>
            </aside>

            <section className={styles.previewPanel}>
              <div className={styles.previewHeader}>
                <strong>Plantilla A4 definitiva</strong>
                <span>La exportación usa exactamente estos datos y estilos.</span>
              </div>
              {previewLoading ? (
                <div className={styles.previewState}>
                  <Spinner label="Actualizando vista previa" />
                </div>
              ) : previewHtml ? (
                <div className={styles.previewScroller}>
                  <iframe
                    className={styles.preview}
                    srcDoc={previewHtml}
                    title="Vista previa de la boleta de notas"
                  />
                </div>
              ) : (
                <p className={styles.empty}>No hay una vista previa disponible.</p>
              )}
            </section>
          </div>

          <section className={styles.history}>
            <header>
              <div>
                <p className={styles.eyebrow}>Archivo privado</p>
                <h3>Historial de PDFs</h3>
              </div>
              <button
                className={styles.textButton}
                onClick={() => loadPage()}
                type="button"
              >
                Actualizar
              </button>
            </header>
            {!history.length ? (
              <p className={styles.empty}>
                Todavía no se ha generado ningún PDF para este grupo.
              </p>
            ) : (
              <div className={styles.historyList}>
                {history.map((generation) => (
                  <article key={generation.id}>
                    <div>
                      <strong>{generation.file_name}</strong>
                      <span>
                        {scopeLabel(generation.scope)} ·{" "}
                        {generation.student_count} página(s) ·{" "}
                        {fileSize(generation.byte_size)}
                      </span>
                      <small>
                        {new Intl.DateTimeFormat("es-PE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(generation.created_at))}
                        {" · "}
                        SHA-256 {generation.content_sha256.slice(0, 12)}…
                      </small>
                    </div>
                    <button
                      className={styles.secondaryButton}
                      disabled={Boolean(busy)}
                      onClick={async () => {
                        setBusy(`download:${generation.id}`);
                        setError("");
                        try {
                          await download(
                            generation.id,
                            generation.file_name,
                          );
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "No se pudo descargar el PDF.",
                          );
                        } finally {
                          setBusy("");
                        }
                      }}
                      type="button"
                    >
                      {busy === `download:${generation.id}`
                        ? "Descargando…"
                        : "Descargar"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
