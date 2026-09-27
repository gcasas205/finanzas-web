import { generateId, calcularFechaPagoTarjeta } from "@/lib/utils";
import type { TransactionInput } from "@/lib/validations";
import type { AppConfig, Transaction } from "@/types";

/**
 * Arma la transacción que se persiste a partir de la entrada validada. Única
 * fuente de normalización para alta, edición e importación: la fecha de pago de
 * tarjeta se deriva en el servidor y los campos de ahorro sólo aplican a USD.
 */
export function buildTransaction(
  body: TransactionInput,
  config: Pick<AppConfig, "cardCutoffDay" | "cardDueDay">,
): Transaction {
  let fechaPago = body.fechaPago;
  if (!fechaPago && body.fuente === "tarjeta") {
    fechaPago = calcularFechaPagoTarjeta(body.fechaConsumo, config.cardCutoffDay, config.cardDueDay);
  }
  const esUSD = body.moneda === "USD";
  return {
    id: body.id || generateId(),
    fechaConsumo: body.fechaConsumo,
    fechaPago: fechaPago || body.fechaConsumo,
    tipo: body.tipo,
    descripcion: body.descripcion,
    monto: body.monto,
    moneda: body.moneda,
    categoria: body.categoria,
    subcategoria: body.subcategoria,
    fuente: body.fuente,
    cuotaTotal: body.cuotaTotal,
    cuotaNumero: body.cuotaNumero,
    notas: body.notas || "",
    createdAt: body.createdAt || new Date().toISOString(),
    origen: esUSD && body.tipo === "egreso" ? body.origen || "regla" : undefined,
    asigMediano: esUSD && body.tipo === "ingreso" ? body.asigMediano || 0 : undefined,
    asigLargo: esUSD && body.tipo === "ingreso" ? body.asigLargo || 0 : undefined,
  };
}
