import type { Cotizacion } from "@/types";

/**
 * Scraper de la cotización del dólar oficial desde dolarhoy.com.
 *
 * La página renderiza los valores en HTML plano dentro de un bloque
 * `<div class="tile cotizacion_value">` con dos `<div class="value">`,
 * así que se pueden extraer con una expresión regular sin depender de
 * ninguna librería de parseo.
 *
 * Se cachea en memoria del proceso para no pegarle a dolarhoy en cada
 * request (y para tolerar caídas puntuales del sitio).
 */

const DOLARHOY_URL = "https://dolarhoy.com/cotizaciondolaroficial";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

let cache: { data: Cotizacion; at: number } | null = null;

/** Convierte "1.470,00" o "1470,00" (formato AR) a number */
function parseNumAR(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

function parseCotizacion(html: string): Cotizacion {
  // Ancla en el div real (evita el primer match, que está dentro de un <style>)
  const m = html.match(
    /tile cotizacion_value["'][\s\S]{0,1200}?Compra<\/div>\s*<div class="value">\s*\$?\s*([\d.,]+)[\s\S]{0,400}?Venta<\/div>\s*<div class="value">\s*\$?\s*([\d.,]+)/i
  );
  if (!m) throw new Error("No se encontraron los valores de compra/venta");

  const upd = html.match(/Actualizado por última vez:\s*([^<]+)</i);

  return {
    compra: parseNumAR(m[1]),
    venta: parseNumAR(m[2]),
    actualizado: upd ? upd[1].trim() : null,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Devuelve la cotización oficial. Usa caché de 10 minutos.
 * Si el scraping falla y hay caché vieja, la devuelve; si no, tira error
 * controlado que la API traduce a un fallback editable por el usuario.
 */
export async function getCotizacionOficial(force = false): Promise<Cotizacion> {
  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL) {
    return cache.data;
  }

  try {
    const res = await fetch(DOLARHOY_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; finanzas-web/1.0; +https://github.com/gcasas205/finanzas-web)",
      },
      // Evita que Next cachee la respuesta a nivel fetch; el caché lo maneja este módulo
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`dolarhoy respondió ${res.status}`);
    const html = await res.text();
    const data = parseCotizacion(html);
    cache = { data, at: now };
    return data;
  } catch (e) {
    console.error("Error obteniendo cotización de dolarhoy:", e);
    // Si tenemos algo en caché, aunque esté vencido, es mejor que nada
    if (cache) return cache.data;
    throw e;
  }
}
