/**
 * Colores para lo que no se puede estilar con clases (Recharts, SVG, style={}).
 * Espejo de tailwind.config.js: si cambia un token allá, cambia acá. Nada de
 * hex sueltos en los componentes.
 *
 * Voces (ver DESIGN.md): el ámbar de marca NO se usa para datos; las series
 * neutras (ahorro, tenencia, capital) van en tonos de papel; verde/rojo sólo
 * cuando el dato es un resultado bueno/malo.
 */
export const PALETTE = {
  /** Texto de ejes y rótulos de gráficos (ink-300, 5.2:1). */
  eje: "#8A8576",
  /** Líneas de grilla (ink-600). */
  grilla: "#252420",
  /** Fondo de pistas de progreso (ink-700). */
  pista: "#1A1916",
  /** Serie neutra principal: ahorro, tenencia, capital (ink-200). */
  serie: "#C9C1AE",
  /** Serie neutra secundaria / período anterior (ink-500 aclarado). */
  serieSecundaria: "#5A574E",
  /** Resultado bueno / ingresos (moss-light). */
  positivo: "#6A8970",
  /** Resultado malo / gastos (terra). */
  negativo: "#A04A2F",
  /** Negativo como texto sobre oscuro (terra-light, 6.9:1). */
  negativoTexto: "#D4886E",
  /** Marca: sólo logo y loader. */
  marca: "#C9A24B",
  /** Cursor de hover de los gráficos. */
  cursor: "rgba(244,241,234,0.03)",
} as const;
