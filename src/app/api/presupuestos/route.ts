import { NextResponse } from "next/server";
import { getPresupuestos, savePresupuestos } from "@/lib/sheets";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import { readJson, withErrors } from "@/lib/errors";
import { PresupuestosSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const CACHE_KEY = "presupuestos";

export const GET = withErrors(async () => {
  const presupuestos = await cacheOrFetch(CACHE_KEY, () => getPresupuestos(), 2 * 60 * 1000);
  return NextResponse.json({ presupuestos });
});

export const PUT = withErrors(async (req) => {
  const { presupuestos } = await readJson(req, PresupuestosSchema);
  const positivos = Object.fromEntries(Object.entries(presupuestos).filter(([, v]) => v > 0));
  await savePresupuestos(positivos);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true, presupuestos: positivos });
});
