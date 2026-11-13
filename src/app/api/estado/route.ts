import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    app: "CR Libretas",
    status: "ok",
    phase: 6,
    supabaseConfigured: hasSupabaseConfig(),
  });
}
