import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, SheetsError, withErrors, readJson } from "@/lib/errors";
import { buildTransaction } from "@/lib/transactions";
import { isEmailAllowed, getAllowedEmails, safeInternalPath } from "@/lib/allowlist";
import { TransactionSchema, IdSchema } from "@/lib/validations";

const req = (body?: string) =>
  new Request("http://localhost/api/x", { method: "POST", body, headers: { "Content-Type": "application/json" } });

describe("withErrors", () => {
  it("convierte AppError en { detail, code, field } con su status", async () => {
    const h = withErrors(async () => {
      throw new AppError(409, "duplicate", "Ya existe", "id");
    });
    const r = await h(req(), undefined);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ detail: "Ya existe", code: "duplicate", field: "id" });
  });
  it("una falla de Sheets es 503, no una lista vacía", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await withErrors(async () => { throw new SheetsError(); })(req(), undefined);
    expect(r.status).toBe(503);
    expect((await r.json()).code).toBe("sheets_unavailable");
  });
  it("un error inesperado no filtra el mensaje interno", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await withErrors(async () => { throw new Error("stack secreto"); })(req(), undefined);
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body.code).toBe("internal");
    expect(body.detail).not.toMatch(/secreto/);
  });
});

describe("readJson", () => {
  it("JSON inválido → 400 invalid_json", async () => {
    await expect(readJson(req("{no"), IdSchema)).rejects.toMatchObject({ status: 400, code: "invalid_json" });
  });
  it("valida contra el schema", async () => {
    await expect(readJson(req(JSON.stringify({})), IdSchema)).rejects.toMatchObject({ code: "validation" });
    await expect(readJson(req(JSON.stringify({ id: "abc" })), IdSchema)).resolves.toEqual({ id: "abc" });
  });
});

describe("buildTransaction", () => {
  const cfg = { cardCutoffDay: 23, cardDueDay: 5 };
  const input = TransactionSchema.parse({
    fechaConsumo: "2026-03-25",
    tipo: "egreso",
    descripcion: "Zapatillas",
    monto: 100,
    categoria: "Ropa",
    subcategoria: "Calzado",
    fuente: "tarjeta",
    origen: "tec",
  });
  it("deriva la fecha de pago de tarjeta en el servidor", () => {
    expect(buildTransaction(input, cfg).fechaPago).toBe("2026-05-05");
  });
  it("los campos de ahorro sólo aplican a USD", () => {
    expect(buildTransaction(input, cfg).origen).toBeUndefined();
    const usd = buildTransaction({ ...input, moneda: "USD" }, cfg);
    expect(usd.origen).toBe("tec");
  });
  it("respeta la fecha de pago explícita", () => {
    expect(buildTransaction({ ...input, fechaPago: "2026-04-01" }, cfg).fechaPago).toBe("2026-04-01");
  });
});

describe("allowlist", () => {
  const original = process.env.ALLOWED_EMAILS;
  afterEach(() => { process.env.ALLOWED_EMAILS = original; });

  it("falla cerrado: sin lista no entra nadie", () => {
    process.env.ALLOWED_EMAILS = "";
    expect(getAllowedEmails()).toEqual([]);
    expect(isEmailAllowed("alguien@gmail.com")).toBe(false);
  });
  it("compara sin importar mayúsculas ni espacios", () => {
    process.env.ALLOWED_EMAILS = " Yo@Gmail.com , otro@x.com";
    expect(isEmailAllowed("yo@gmail.com")).toBe(true);
    expect(isEmailAllowed("intruso@gmail.com")).toBe(false);
    expect(isEmailAllowed(undefined)).toBe(false);
  });
  it("safeInternalPath evita redirecciones abiertas", () => {
    expect(safeInternalPath("/dolares?x=1")).toBe("/dolares?x=1");
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("https://evil.com")).toBe("/");
    expect(safeInternalPath("/\\evil.com")).toBe("/");
    expect(safeInternalPath(null)).toBe("/");
  });
});
