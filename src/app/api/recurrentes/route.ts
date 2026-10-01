import { NextResponse } from "next/server";
import { listRecurrentes, addRecurrente, updateRecurrentes, deleteRecurrente } from "@/lib/sheets";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import { AppError, NotFoundError, readJson, withErrors } from "@/lib/errors";
import { IdSchema, RecurrenteSchema } from "@/lib/validations";
import { generateId } from "@/lib/utils";
import type { Recurrente } from "@/types";

export const dynamic = "force-dynamic";

const RECURRENTES_CACHE_KEY = "recurrentes"; // también lo invalida /api/recurrentes/cargar

export const GET = withErrors(async () => {
  const recurrentes = await cacheOrFetch(RECURRENTES_CACHE_KEY, () => listRecurrentes(), 3 * 60 * 1000);
  return NextResponse.json({ recurrentes });
});

export const POST = withErrors(async (req) => {
  const body = await readJson(req, RecurrenteSchema);
  const r: Recurrente = { ...body, id: generateId(), ultimoMes: "", createdAt: new Date().toISOString() };
  await addRecurrente(r);
  cacheInvalidate(RECURRENTES_CACHE_KEY);
  return NextResponse.json({ ok: true, recurrente: r }, { status: 201 });
});

export const PUT = withErrors(async (req) => {
  const body = await readJson(req, RecurrenteSchema);
  if (!body.id) throw new AppError(400, "validation", "Falta el id del gasto fijo", "id");
  const previo = (await listRecurrentes()).find((r) => r.id === body.id);
  if (!previo) throw new NotFoundError("Gasto fijo");
  const r: Recurrente = { ...previo, ...body, id: previo.id };
  await updateRecurrentes([r]);
  cacheInvalidate(RECURRENTES_CACHE_KEY);
  return NextResponse.json({ ok: true, recurrente: r });
});

export const DELETE = withErrors(async (req) => {
  const { id } = await readJson(req, IdSchema);
  if (!(await deleteRecurrente(id))) throw new NotFoundError("Gasto fijo");
  cacheInvalidate(RECURRENTES_CACHE_KEY);
  return NextResponse.json({ ok: true });
});
