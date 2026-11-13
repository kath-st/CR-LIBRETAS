import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requestAccessToken, safePdfFileName } from "@/features/reports/report-api";

export function backupAccessToken(request: NextRequest) {
  return requestAccessToken(request);
}

export function backupError(message: string, status: number) {
  return NextResponse.json(
    { error: "BACKUP_REQUEST_FAILED", message },
    { status },
  );
}

export function backupFileName(
  academicYear: number,
  displayName: string,
  suffix = "",
) {
  return `${safePdfFileName(
    `respaldo-${academicYear}-${displayName}${suffix}`,
  )}.json`;
}

export function jsonDownload(document: unknown, fileName: string) {
  return new NextResponse(JSON.stringify(document, null, 2), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        fileName,
      )}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
