import { NextResponse } from "next/server";
import { loadConfig, saveConfig, testConnection } from "@/lib/sheets";
import { cacheOrFetch, cacheClear } from "@/lib/cache";
import { ConfigSchema } from "@/lib/validations";
import { AppError, SheetsError, readJson, withErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrors(async () => {
  const config = await loadConfig();
  // testConnection se cachea 5 minutos para no abusar
  const connection = await cacheOrFetch("connection-test", () => testConnection(), 5 * 60 * 1000);
  return NextResponse.json({ config, connection });
});

export const POST = withErrors(async (req) => {
  const body = await readJson(req, ConfigSchema);
  let config;
  try {
    config = await saveConfig(body);
  } catch (e) {
    if (e instanceof AppError) throw e;
    // No se escribió la hoja Config: no respondemos "guardado".
    console.error("[api] POST /api/config:", e);
    throw new SheetsError("No se pudieron guardar los ajustes en la hoja Config. Probá de nuevo.");
  }
  // Invalidar todo el caché porque cambió la config (puede cambiar la sheet)
  cacheClear();
  const connection = await testConnection();
  return NextResponse.json({ config, connection });
});
