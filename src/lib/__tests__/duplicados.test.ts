import { describe, expect, it } from "vitest";
import { separarDuplicados } from "@/lib/duplicados";

const t = (descripcion: string, monto: number, fechaConsumo = "2026-09-01", cuotaNumero = 1) =>
  ({ descripcion, monto, fechaConsumo, cuotaNumero });

describe("separarDuplicados", () => {
  it("detecta lo ya cargado sin importar mayúsculas ni espacios", () => {
    const r = separarDuplicados([t("COTO  Palermo", 1500), t("YPF", 30000)], [t("coto palermo", 1500)]);
    expect(r.duplicados).toHaveLength(1);
    expect(r.nuevos.map((x) => x.descripcion)).toEqual(["YPF"]);
  });
  it("respeta repeticiones legítimas", () => {
    const r = separarDuplicados([t("Café", 2000), t("Café", 2000)], [t("Café", 2000)]);
    expect(r.duplicados).toHaveLength(1);
    expect(r.nuevos).toHaveLength(1);
  });
  it("otra cuota de la misma compra no es duplicado", () => {
    const r = separarDuplicados([t("Heladera", 50000, "2026-05-10", 4)], [t("Heladera", 50000, "2026-05-10", 3)]);
    expect(r.nuevos).toHaveLength(1);
  });
});
