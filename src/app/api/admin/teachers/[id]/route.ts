import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dniToInternalEmail } from "@/lib/auth/identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBearerClient } from "@/lib/supabase/server";

const detailsSchema = z.object({
  operation: z.literal("details"),
  dni: z.string().trim().regex(/^\d{8}$/),
  nombres: z.string().trim().min(2).max(80),
  apellidos: z.string().trim().min(2).max(100),
});

const passwordSchema = z.object({
  operation: z.literal("temporary-password"),
  password: z.string().min(8).max(72),
});

const requestSchema = z.discriminatedUnion("operation", [
  detailsSchema,
  passwordSchema,
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function isActiveAdmin(accessToken: string) {
  const client = createBearerClient(accessToken);
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("status", "activo")
    .limit(1)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!accessToken || !(await isActiveAdmin(accessToken))) {
    return jsonError("La sesión administradora no es válida.", 403);
  }

  const { id } = await context.params;
  const parsedId = z.string().uuid().safeParse(id);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("La solicitud no contiene JSON válido.", 400);
  }
  const parsedBody = requestSchema.safeParse(body);
  if (!parsedId.success || !parsedBody.success) {
    return jsonError("La solicitud contiene datos inválidos.", 400);
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (targetError || !target || target.role !== "docente") {
    return jsonError("No se encontró la cuenta docente.", 404);
  }

  if (parsedBody.data.operation === "temporary-password") {
    const { error: passwordError } = await admin.auth.admin.updateUserById(
      parsedId.data,
      { password: parsedBody.data.password },
    );
    if (passwordError) {
      return jsonError("No se pudo asignar la contraseña temporal.", 502);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", parsedId.data);
    if (profileError) {
      return jsonError(
        "La contraseña cambió, pero no se pudo marcar el cambio obligatorio.",
        502,
      );
    }

    return NextResponse.json({
      message: "Contraseña temporal asignada correctamente.",
    });
  }

  const { dni, nombres, apellidos } = parsedBody.data;
  const { error: authError } = await admin.auth.admin.updateUserById(
    parsedId.data,
    {
      email: dniToInternalEmail(dni),
      email_confirm: true,
      user_metadata: { dni, nombres, apellidos },
    },
  );
  if (authError) {
    return jsonError(
      "No se pudo actualizar el acceso. Verifica que el DNI no esté registrado.",
      409,
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ dni, nombres, apellidos })
    .eq("id", parsedId.data);
  if (profileError) {
    return jsonError(
      "El acceso cambió, pero no se pudo actualizar el perfil.",
      502,
    );
  }

  return NextResponse.json({
    message: "Datos de la docente actualizados correctamente.",
  });
}
