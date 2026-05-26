import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasSheet = Boolean(process.env.GOOGLE_SHEET_ID);
  const hasCreds = Boolean(process.env.GOOGLE_SHEETS_CREDS_JSON);

  return NextResponse.json({
    envReady: hasSheet && hasCreds,
    debug: {
      hasSheet,
      hasCreds,
      sheetIdPrefix: process.env.GOOGLE_SHEET_ID?.slice(0, 8) || "NOT SET",
      credsPrefix: process.env.GOOGLE_SHEETS_CREDS_JSON?.slice(0, 30) || "NOT SET",
    }
  });
}