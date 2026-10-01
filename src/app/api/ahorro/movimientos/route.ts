import { NextResponse } from "next/server";
import { listMovAhorro, addMovAhorro, deleteMovAhorro } from "@/lib/sheets";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import { NotFoundError, readJson, withErrors } from "@/lib/errors";
import { IdSchema, MovAhorroSchema } from "@/lib/validations";
import { generateId } from "@/lib/utils";
import type { MovAhorro } from "@/types";

export const dynamic = "force-dynamic";

const CACHE_KEY = "mov-ahorro";
const CACHE_TTL = 3 * 60 * 1000;

export const GET = withErrors(async () => {
  const movimientos = await cacheOrFetch(CACHE_KEY, () => listMovAhorro(), CACHE_TTL);
  return NextResponse.json({ movimientos });
});

export const POST = withErrors(async (req) => {
  const body = await readJson(req, MovAhorroSchema);
  const mov: MovAhorro = { id: generateId(), ...body, notas: body.notas ?? "", createdAt: new Date().toISOString() };
  await addMovAhorro(mov);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true, movimiento: mov }, { status: 201 });
});

export const DELETE = withErrors(async (req) => {
  const { id } = await readJson(req, IdSchema);
  if (!(await deleteMovAhorro(id))) throw new NotFoundError("Pase");
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true });
});
