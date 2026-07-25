import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadReportAssets } from "@/features/reports/report-assets";
import { requestAccessToken } from "@/features/reports/report-api";
import {
  loadReportSnapshot,
  ReportDataError,
} from "@/features/reports/report-data";
import { buildReportHtml } from "@/features/reports/report-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  enrollmentId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const accessToken = requestAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: "La sesión no es válida." },
      { status: 401 },
    );
  }

  try {
    const { groupId } = await context.params;
    const parsedGroup = z.string().uuid().safeParse(groupId);
    const parsedBody = bodySchema.safeParse(await request.json());
    if (!parsedGroup.success || !parsedBody.success) {
      return NextResponse.json(
        { error: "La solicitud contiene datos inválidos." },
        { status: 400 },
      );
    }

    const [{ snapshot }, assets] = await Promise.all([
      loadReportSnapshot(accessToken, parsedGroup.data, [
        parsedBody.data.enrollmentId,
      ]),
      loadReportAssets(),
    ]);

    return NextResponse.json({
      html: buildReportHtml(snapshot, assets),
      studentName: snapshot.cards[0]?.studentName ?? "",
    });
  } catch (cause) {
    const status = cause instanceof ReportDataError ? cause.status : 500;
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "No se pudo preparar la vista previa.",
      },
      { status },
    );
  }
}
