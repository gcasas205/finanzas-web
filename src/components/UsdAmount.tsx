import React from "react";

/**
 * Muestra un monto en dólares con los centavos como superíndice:
 *   US$ 1.234⁵⁶
 * El entero va con separador de miles es-AR (punto) y los centavos
 * en chiquito, arriba a la derecha. El tamaño es relativo (em), así
 * escala solo según el tamaño de fuente del contenedor.
 */
export function UsdAmount({
  value,
  symbol = true,
  className,
}: {
  value: number;
  symbol?: boolean;
  className?: string;
}) {
  const neg = value < 0;
  const totalCents = Math.round(Math.abs(value) * 100);
  const intPart = Math.floor(totalCents / 100);
  const cents = totalCents % 100;

  const intStr = intPart.toLocaleString("es-AR");
  const centStr = String(cents).padStart(2, "0");

  return (
    <span className={className} style={{ whiteSpace: "nowrap" }}>
      {neg ? "-" : ""}
      {symbol ? "US$\u00A0" : ""}
      {intStr}
      <span
        style={{
          fontSize: "0.55em",
          verticalAlign: "0.45em",
          marginLeft: "0.08em",
          fontWeight: 400,
          letterSpacing: "0.02em",
        }}
      >
        {centStr}
      </span>
    </span>
  );
}