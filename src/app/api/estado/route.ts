import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    app: "CR Libretas",
    phase: 1,
    supabaseConfigured: hasSupabaseConfig(),
  });
}
