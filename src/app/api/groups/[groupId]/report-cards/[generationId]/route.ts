import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requestAccessToken } from "@/features/reports/report-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBearerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ generationId: string; groupId: string }>;
  },
) {
  const accessToken = requestAccessToken(request);
  const { generationId, groupId } = await context.params;
  if (
    !accessToken ||
    !z.string().uuid().safeParse(groupId).success ||
    !z.string().uuid().safeParse(generationId).success
  ) {
    return NextResponse.json(
      { error: "La solicitud no es válida." },
      { status: 400 },
    );
  }

  const client = createBearerClient(accessToken);
  const { data: generation, error } = await client
    .from("report_card_generations")
    .select("file_name, storage_bucket, storage_path")
    .eq("id", generationId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error || !generation) {
    return NextResponse.json(
      { error: "No tienes acceso a este PDF o ya no existe." },
      { status: 404 },
    );
  }

  const admin = createAdminClient();
  const { data, error: downloadError } = await admin.storage
    .from(generation.storage_bucket)
    .download(generation.storage_path);
  if (downloadError || !data) {
    return NextResponse.json(
      { error: "No se pudo recuperar el archivo privado." },
      { status: 502 },
    );
  }

  const fileName = encodeURIComponent(generation.file_name);
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
