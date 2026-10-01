import type { CategoryConfig, ReglaCategoria } from "@/types";

/**
 * Categorías por defecto. Las reales viven en la pestaña "Categorias" de la
 * planilla (se siembra con estas); el cliente las lee con `useCategorias()`.
 */
export const CATEGORIES: CategoryConfig[] = [
  {
    name: "Ingresos",
    subcategories: ["Sueldo", "Freelance", "Inversión", "Bono", "Reintegro", "Otro"],
    color: "#6A8970",
  },
  {
    name: "Vivienda",
    subcategories: ["Alquiler", "Expensas", "Servicios", "Internet", "Mantenimiento"],
    color: "#C9A24B",
  },
  {
    name: "Alimentación",
    subcategories: ["Supermercado", "Delivery", "Restaurante", "Cafetería"],
    color: "#A04A2F",
  },
  {
    name: "Transporte",
    subcategories: ["Peaje", "Combustible", "Público", "Taxi/Uber", "Estacionamiento"],
    color: "#D4886E",
  },
  {
    name: "Salud",
    subcategories: ["Prepaga", "Médico", "Farmacia", "Gym", "Terapia"],
    color: "#3D5A47",
  },
  {
    name: "Tecnología",
    subcategories: ["Suscripciones", "Software", "Hardware", "Juegos"],
    color: "#E8C982",
  },
  {
    name: "Entretenimiento",
    subcategories: ["Streaming", "Música", "Cine", "Eventos", "Salidas"],
    color: "#8C6F2F",
  },
  {
    name: "Personal",
    subcategories: ["Ropa", "Calzado", "Cosméticos", "Peluquería"],
    color: "#6E2F1C",
  },
  {
    name: "Seguros",
    subcategories: ["Auto", "Hogar", "Vida", "Otro"],
    color: "#5A574E",
  },
  {
    name: "Finanzas",
    subcategories: ["Comisión", "Impuesto", "Cuota tarjeta", "Interés"],
    color: "#8A8576"
  },
  {
    name: "Otros",
    subcategories: ["Varios", "Sin categoría"],
    color: "#3A3833",
  },
];

const AUTO_RULES: Array<[string, string, string]> = [
  // [keyword, categoria, subcategoria]
  ["spotify", "Tecnología", "Suscripciones"],
  ["apple.com", "Tecnología", "Suscripciones"],
  ["netflix", "Entretenimiento", "Streaming"],
  ["disney", "Entretenimiento", "Streaming"],
  ["hbo", "Entretenimiento", "Streaming"],
  ["steam", "Tecnología", "Juegos"],
  ["openai", "Tecnología", "Suscripciones"],
  ["chatgpt", "Tecnología", "Suscripciones"],
  ["anthropic", "Tecnología", "Suscripciones"],
  ["claude", "Tecnología", "Suscripciones"],
  ["personal", "Tecnología", "Suscripciones"],
  ["claro", "Tecnología", "Suscripciones"],
  ["movistar", "Tecnología", "Suscripciones"],
  ["fibertel", "Vivienda", "Internet"],
  ["telecentro", "Vivienda", "Internet"],
  ["mercadolibre", "Alimentación", "Delivery"],
  ["rappi", "Alimentación", "Delivery"],
  ["pedidosya", "Alimentación", "Delivery"],
  ["uber", "Transporte", "Taxi/Uber"],
  ["cabify", "Transporte", "Taxi/Uber"],
  ["didi", "Transporte", "Taxi/Uber"],
  ["autopista", "Transporte", "Peaje"],
  ["autopistas", "Transporte", "Peaje"],
  ["camino pque", "Transporte", "Peaje"],
  ["ausa", "Transporte", "Peaje"],
  ["ypf", "Transporte", "Combustible"],
  ["shell", "Transporte", "Combustible"],
  ["axion", "Transporte", "Combustible"],
  ["sancor", "Salud", "Prepaga"],
  ["osde", "Salud", "Prepaga"],
  ["swiss medical", "Salud", "Prepaga"],
  ["galeno", "Salud", "Prepaga"],
  ["san cristobal", "Seguros", "Otro"],
  ["la caja", "Seguros", "Otro"],
  ["zurich", "Seguros", "Otro"],
  ["megatone", "Tecnología", "Hardware"],
  ["fravega", "Tecnología", "Hardware"],
  ["coto", "Alimentación", "Supermercado"],
  ["jumbo", "Alimentación", "Supermercado"],
  ["carrefour", "Alimentación", "Supermercado"],
  ["dia", "Alimentación", "Supermercado"],
  ["elangar", "Alimentación", "Supermercado"],
  ["disco", "Alimentación", "Supermercado"],
  ["edenor", "Vivienda", "Servicios"],
  ["edesur", "Vivienda", "Servicios"],
  ["metrogas", "Vivienda", "Servicios"],
  ["aysa", "Vivienda", "Servicios"],
  ["abl", "Vivienda", "Servicios"],
  ["sueldo", "Ingresos", "Sueldo"],
  ["haberes", "Ingresos", "Sueldo"],
];

/**
 * Descripción normalizada para comparar comercios: minúsculas, sin acentos, sin
 * números ni signos (los códigos de comprobante cambian) y sin letras sueltas.
 */
export function normalizarDescripcion(descripcion: string): string {
  return descripcion
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .join(" ");
}

/** Clave de un comercio: sus primeras 3 palabras normalizadas (ej. "coto palermo"). */
export function claveComercio(descripcion: string): string {
  return normalizarDescripcion(descripcion).split(" ").slice(0, 3).join(" ");
}

/**
 * Sugiere categoría para una descripción. Primero las reglas aprendidas (la más
 * específica gana), después las incorporadas.
 */
export function autoCategorizar(
  descripcion: string,
  reglas: ReglaCategoria[] = [],
): { categoria: string; subcategoria: string } {
  if (reglas.length) {
    const norm = ` ${normalizarDescripcion(descripcion)} `;
    const match = reglas
      .filter((r) => r.palabra && norm.includes(` ${r.palabra} `))
      .sort((a, b) => b.palabra.length - a.palabra.length)[0];
    if (match) return { categoria: match.categoria, subcategoria: match.subcategoria };
  }
  const desc = descripcion.toLowerCase();
  for (const [kw, cat, subcat] of AUTO_RULES) {
    if (desc.includes(kw)) {
      return { categoria: cat, subcategoria: subcat };
    }
  }
  return { categoria: "Otros", subcategoria: "Sin categoría" };
}

export function getCategoryColor(name: string, categorias: CategoryConfig[] = CATEGORIES): string {
  return categorias.find(c => c.name === name)?.color ?? CATEGORIA_COLORES[CATEGORIA_COLORES.length - 1];
}

/** Colores elegibles para una categoría (los de las categorías por defecto). */
export const CATEGORIA_COLORES: string[] = Array.from(new Set(CATEGORIES.map((c) => c.color)));
