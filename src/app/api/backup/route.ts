import { NextResponse } from "next/server";
import {
  listTransactions, listSueldos, listDolarOps, loadConfig, getAhorroConfig,
  listMovAhorro, getPresupuestos, listCategorias, listReglas, listRecurrentes,
} from "@/lib/sheets";
import { withErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Copia de seguridad de todo lo guardado en la planilla, leída en el momento
 * (sin caché). No incluye datos de conexión (Sheet ID ni credenciales).
 */
export const GET = withErrors(async () => {
  const [transacciones, sueldos, dolares, config, ahorro, pasesAhorro, presupuestos, categorias, reglas, gastosFijos] =
    await Promise.all([
      listTransactions(), listSueldos(), listDolarOps(), loadConfig(), getAhorroConfig(),
      listMovAhorro(), getPresupuestos(), listCategorias(), listReglas(), listRecurrentes(),
    ]);
  const { googleSheetId: _id, googleCredsPath: _creds, ...ajustes } = config;
  return NextResponse.json({
    version: 2,
    generado: new Date().toISOString(),
    ajustes,
    ahorro,
    pasesAhorro,
    presupuestos,
    categorias,
    reglas,
    gastosFijos,
    transacciones,
    sueldos,
    dolares,
  });
});
