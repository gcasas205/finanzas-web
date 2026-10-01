import { describe, expect, it } from "vitest";
import { aprenderReglas } from "@/lib/reglas";
import { autoCategorizar, claveComercio } from "@/lib/categories";

describe("autocategorización que aprende", () => {
  it("la clave ignora códigos y números", () => {
    expect(claveComercio("001586*COTO 123 PALERMO")).toBe("coto palermo");
  });
  it("aprende cuando corregís la sugerencia y la usa la próxima vez", () => {
    const antes = autoCategorizar("VERDULERIA DON PEPE 4455");
    expect(antes.categoria).toBe("Otros");
    const reglas = aprenderReglas([], [{ descripcion: "VERDULERIA DON PEPE 4455", categoria: "Alimentación", subcategoria: "Supermercado" }]);
    expect(reglas).toEqual([{ palabra: "verduleria don pepe", categoria: "Alimentación", subcategoria: "Supermercado" }]);
    expect(autoCategorizar("Verdulería Don Pepe 9999", reglas!)).toEqual({ categoria: "Alimentación", subcategoria: "Supermercado" });
  });
  it("una regla aprendida le gana a la incorporada", () => {
    const reglas = aprenderReglas([], [{ descripcion: "COTO DIGITAL", categoria: "Tecnología", subcategoria: "Software" }]);
    expect(autoCategorizar("coto digital", reglas!).categoria).toBe("Tecnología");
  });
  it("si coincide con lo sugerido no guarda nada", () => {
    expect(aprenderReglas([], [{ descripcion: "NETFLIX", categoria: "Entretenimiento", subcategoria: "Streaming" }])).toBeNull();
  });
});
