import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Cliente de Google falso que cuenta las lecturas (la cuota de Sheets es de 60 lecturas/min).
const h = vi.hoisted(() => {
  const TABS = ["Transacciones", "Sueldos", "Dolares", "Config", "MovAhorro", "Categorias", "Reglas", "Recurrentes"];
  const lecturas = { total: 0 };
  const fallar = { proxima: null as null | { code: number } };
  const header = Array.from({ length: 30 }, (_, i) => `h${i}`);
  const valores = (range: string) => (range.includes("A1:") ? [header] : []);
  const sheets = {
    spreadsheets: {
      get: async () => { lecturas.total++; return { data: { sheets: TABS.map((title) => ({ properties: { title } })) } }; },
      batchUpdate: async () => ({ data: {} }),
      values: {
        get: async ({ range }: { range: string }) => { lecturas.total++; return { data: { values: valores(range) } }; },
        batchGet: async ({ ranges }: { ranges: string[] }) => {
          lecturas.total++;
          if (fallar.proxima && !ranges[0].includes("A1:")) {
            const e = fallar.proxima;
            fallar.proxima = null;
            throw Object.assign(new Error("Quota exceeded"), e);
          }
          return { data: { valueRanges: ranges.map((range) => ({ range, values: valores(range) })) } };
        },
        update: async () => ({ data: {} }),
        append: async () => ({ data: {} }),
        batchUpdate: async () => ({ data: {} }),
        clear: async () => ({ data: {} }),
      },
    },
  };
  return { lecturas, sheets, fallar };
});

vi.mock("googleapis", () => ({
  google: { auth: { GoogleAuth: class {} }, sheets: () => h.sheets },
}));

type Sheets = typeof import("@/lib/sheets");
let s: Sheets;

beforeAll(async () => {
  process.env.GOOGLE_SHEET_ID = "planilla-de-prueba";
  process.env.GOOGLE_SHEETS_CREDS_JSON = "{}";
  s = await import("@/lib/sheets");
});

beforeEach(() => { h.lecturas.total = 0; });

/** Lo que pide la app al abrirse: todas las vistas cargan sus datos a la vez. */
const abrirApp = () => Promise.all([
  s.listTransactions(), s.listDolarOps(), s.getAhorroConfig(), s.loadConfig(), s.listCategorias(),
  s.listReglas(), s.getPresupuestos(), s.listRecurrentes(), s.listMovAhorro(), s.listSueldos(), s.testConnection(),
]);

describe("lecturas a Google Sheets", () => {
  it("abrir la app en una instancia nueva hace como mucho 3 lecturas", async () => {
    await abrirApp();
    expect(h.lecturas.total).toBeLessThanOrEqual(3);
  });
  it("volver a pedir los datos enseguida no vuelve a leer", async () => {
    await abrirApp();
    expect(h.lecturas.total).toBe(0);
  });
  it("después de escribir se vuelve a leer la planilla (1 lectura)", async () => {
    await s.addMovAhorro({ id: "m", fecha: "2026-10-01", desde: "auto", hacia: "largo", montoUSD: 1, notas: "", createdAt: "" });
    h.lecturas.total = 0;
    await abrirApp();
    expect(h.lecturas.total).toBe(1);
  });
  it("un límite de cuota (429) se informa claro y no queda guardado", async () => {
    await s.addMovAhorro({ id: "m2", fecha: "2026-10-01", desde: "auto", hacia: "largo", montoUSD: 1, notas: "", createdAt: "" });
    h.fallar.proxima = { code: 429 };
    await expect(s.listTransactions()).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/limitando/) });
    // el siguiente pedido vuelve a intentar y anda
    await expect(s.listTransactions()).resolves.toEqual([]);
  });
});
