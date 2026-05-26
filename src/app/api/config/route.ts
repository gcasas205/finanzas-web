import { NextRequest, NextResponse } from "next/server";
import { loadConfig, saveConfig, testConnection } from "@/lib/sheets";
import { cacheOrFetch, cacheInvalidate, cacheClear } from "@/lib/cache";

export async function GET() {
  const config = await loadConfig();
  // testConnection se cachea 5 minutos para no abusar
  const test = await cacheOrFetch(
    "connection-test",
    () => testConnection(),
    5 * 60 * 1000,
  );
  return NextResponse.json({ config, connection: test });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = await saveConfig(body);
  // Invalidar todo el caché porque cambió la config (puede cambiar la sheet)
  cacheClear();
  const test = await testConnection();
  return NextResponse.json({ config, connection: test });
}
