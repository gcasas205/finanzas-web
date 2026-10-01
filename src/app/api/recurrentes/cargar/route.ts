import { NextResponse } from "next/server";
import { listRecurrentes, updateRecurrentes, addTransactionsBulk, loadConfig } from "@/lib/sheets";
import { cacheInvalidate } from "@/lib/cache";
import { NotFoundError, readJson, withErrors } from "@/lib/errors";
import { CargarRecurrentesSchema, TransactionSchema } from "@/lib/validations";
import { buildTransaction } from "@/lib/transactions";
import { fechaDelMes } from "@/lib/recurrentes";
import { sincronizarSueldos } from "@/lib/sueldos-sync";

export const dynamic = "force-dynamic";

/** Carga como movimientos los gastos fijos elegidos, en el mes indicado. */
export const POST = withErrors(async (req) => {
  const { ids, mes } = await readJson(req, CargarRecurrentesSchema);
  const pedidos = new Set(ids);
  const elegidos = (await listRecurrentes()).filter((r) => pedidos.has(r.id));
  if (elegidos.length !== pedidos.size) throw new NotFoundError("Gasto fijo");

  const config = await loadConfig();
  const txs = elegidos.map((r) =>
    buildTransaction(
      TransactionSchema.parse({
        fechaConsumo: fechaDelMes(mes, r.dia),
        tipo: r.tipo,
        descripcion: r.descripcion,
        monto: r.monto,
        moneda: r.moneda,
        categoria: r.categoria,
        subcategoria: r.subcategoria,
        fuente: r.fuente,
        notas: "Gasto fijo",
      }),
      config,
    ),
  );
  await addTransactionsBulk(txs);
  // Se marca el mes para que no vuelva a aparecer como pendiente
  await updateRecurrentes(elegidos.map((r) => ({ ...r, ultimoMes: r.ultimoMes > mes ? r.ultimoMes : mes })));
  cacheInvalidate("transactions");
  cacheInvalidate("recurrentes");
  await sincronizarSueldos(txs, config.salaryPaymentOffsetMonths);
  return NextResponse.json({ ok: true, cargados: txs.length });
});
