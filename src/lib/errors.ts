import { NextResponse } from "next/server";
import type { ZodError, ZodType, ZodTypeDef } from "zod";

/**
 * Contrato de errores de la API: `{ detail, code, field? }`.
 * - `detail`: texto en castellano para mostrar tal cual al usuario.
 * - `code`: estable, para lógica del cliente (`validation`, `not_found`, `unauthorized`…).
 * - `field`: campo del formulario al que corresponde el error, si aplica.
 */
export interface ApiErrorBody {
  detail: string;
  code: string;
  field?: string;
}

/** Error de dominio: lo levanta la lógica y `withErrors` lo convierte en respuesta. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    detail: string,
    public readonly field?: string,
  ) {
    super(detail);
    this.name = "AppError";
  }
}

/** Falla de Google Sheets (red, cuota, credenciales). Nunca se disfraza de "sin datos". */
export class SheetsError extends AppError {
  constructor(detail = "No pudimos comunicarnos con tu planilla de Google Sheets. Probá de nuevo en un rato.") {
    super(503, "sheets_unavailable", detail);
    this.name = "SheetsError";
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super(404, "not_found", `${what} no encontrado`);
  }
}

export function apiError(status: number, code: string, detail: string, field?: string) {
  const body: ApiErrorBody = { detail, code };
  if (field) body.field = field;
  return NextResponse.json(body, { status });
}

/** Primer problema de Zod → `{ detail, field }` (el formulario marca ese campo). */
export function zodToAppError(err: ZodError): AppError {
  const issue = err.issues[0];
  const field = issue?.path.length ? issue.path.join(".") : undefined;
  return new AppError(400, "validation", issue?.message ?? "Datos inválidos", field);
}

/** Lee el body JSON y lo valida contra el schema. Levanta AppError si algo falla. */
export async function readJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError(400, "invalid_json", "El cuerpo de la solicitud no es JSON válido");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw zodToAppError(parsed.error);
  return parsed.data;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * Envuelve un route handler: los AppError salen con su status/código; cualquier
 * otro error se loguea completo en el servidor y al cliente le llega un mensaje humano.
 */
export function withErrors<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof AppError) {
        if (e.status >= 500) console.error(`[api] ${req.method} ${new URL(req.url).pathname}:`, e.message);
        return apiError(e.status, e.code, e.message, e.field);
      }
      console.error(`[api] Error no controlado en ${req.method} ${new URL(req.url).pathname}:`, e);
      return apiError(500, "internal", "Ocurrió un error inesperado. Probá de nuevo.");
    }
  };
}
