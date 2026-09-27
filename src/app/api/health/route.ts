import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Sólo informa si el entorno está listo. No expone nada de los secretos. */
export async function GET() {
  const envReady = Boolean(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SHEETS_CREDS_JSON);
  return NextResponse.json({ envReady });
}
