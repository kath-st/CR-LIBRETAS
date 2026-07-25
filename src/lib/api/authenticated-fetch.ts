"use client";

import { createClient } from "@/lib/supabase/client";

type ErrorPayload = {
  error?: string;
  message?: string;
  requestId?: string;
};

export async function authenticatedFetch(
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

  let response = await send(currentSession.access_token);
  if (response.status === 401) {
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedSession) {
      throw new Error("La sesión expiró. Vuelve a iniciar sesión.");
    }
    response = await send(refreshedSession.access_token);
  }

  return response;
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & ErrorPayload;
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
