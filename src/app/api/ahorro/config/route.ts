import { NextResponse } from "next/server";
import { getAhorroConfig, saveAhorroConfig } from "@/lib/sheets";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import { readJson, withErrors } from "@/lib/errors";
import { AhorroConfigSchema } from "@/lib/validations";
import { nuevaClaveSobre } from "@/lib/ahorro-config";
import type { AhorroConfig } from "@/types";

export const dynamic = "force-dynamic";

const CACHE_KEY = "ahorro-config";
const CACHE_TTL = 2 * 60 * 1000; // 2 min: los parámetros cambian poco

export const GET = withErrors(async () => {
  const config = await cacheOrFetch(CACHE_KEY, () => getAhorroConfig(), CACHE_TTL);
  return NextResponse.json({ config });
});

/** Guarda el plan completo. Los sobres nuevos (sin clave) reciben una. */
export const PUT = withErrors(async (req) => {
  const body = await readJson(req, AhorroConfigSchema);
  const usadas = new Set(body.sobres.map((s) => s.key).filter((k): k is string => Boolean(k)));
  const config: AhorroConfig = {
    emergenciaObjetivo: body.emergenciaObjetivo,
    sp500RetornoAnual: body.sp500RetornoPct / 100,
    sobres: body.sobres.map((s) => {
      const key = s.key ?? nuevaClaveSobre(s.nombre, usadas);
      usadas.add(key);
      return { key, nombre: s.nombre, pct: s.pct, objetivo: s.objetivo, ...(s.fechaObjetivo ? { fechaObjetivo: s.fechaObjetivo } : {}) };
    }),
  };
  await saveAhorroConfig(config);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true, config });
});
