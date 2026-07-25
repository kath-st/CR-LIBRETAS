import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requestAccessToken } from "@/features/reports/report-api";
import { createBearerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  rows: z
    .array(
      z.object({
        first_names: z.string().trim().min(2).max(100),
        last_names: z.string().trim().min(2).max(120),
      }),
    )
    .min(1)
    .max(200),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: "STUDENT_IMPORT_FAILED", message },
    { status },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const accessToken = requestAccessToken(request);
  if (!accessToken) return errorResponse("La sesión no está disponible.", 401);

  const { groupId } = await context.params;
  const parsedGroup = z.string().uuid().safeParse(groupId);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedGroup.success || !parsedBody.success) {
    return errorResponse("Revisa las filas seleccionadas para importar.", 400);
  }

  const client = createBearerClient(accessToken);
  const { data, error } = await client.rpc("import_students", {
    student_rows: parsedBody.data.rows,
    target_group_id: parsedGroup.data,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return errorResponse(
      error.message || "No se pudo completar la importación.",
      status,
    );
  }

  return NextResponse.json(data);
}
