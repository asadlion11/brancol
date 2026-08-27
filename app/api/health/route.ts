import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
// Env is read per request, never baked into a build artifact.
export const dynamic = "force-dynamic";

export function GET() {
  const { OPENROUTER_PRIMARY_MODEL } = getEnv();

  return NextResponse.json({
    status: "ok",
    model: OPENROUTER_PRIMARY_MODEL,
  });
}
