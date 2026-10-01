import { NextResponse } from "next/server";
import {
  listCategorias, saveCategorias, listReglas, saveReglas, listTransactions, updateTransactionsBulk,
  getPresupuestos, savePresupuestos,
} from "@/lib/sheets";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import { readJson, withErrors } from "@/lib/errors";
import { CategoriasSchema } from "@/lib/validations";
import { renombrarEnReglas } from "@/lib/reglas";
import { CATEGORIAS_CACHE_KEY } from "@/lib/reglas-sync";

export const dynamic = "force-dynamic";

export const GET = withErrors(async () => {
  const data = await cacheOrFetch(
    CATEGORIAS_CACHE_KEY,
    async () => {
      const [categorias, reglas] = await Promise.all([listCategorias(), listReglas()]);
      return { categorias, reglas };
    },
    5 * 60 * 1000,
  );
  return NextResponse.json(data);
});

/**
 * Guarda las categorías. Si alguna se renombró, también actualiza los movimientos,
 * las reglas aprendidas y el presupuesto que la usaban.
 */
export const PUT = withErrors(async (req) => {
  const { categorias, renombres } = await readJson(req, CategoriasSchema);
  const cambios = Object.fromEntries(Object.entries(renombres).filter(([viejo, nuevo]) => viejo !== nuevo));

  await saveCategorias(categorias);

  let migrados = 0;
  if (Object.keys(cambios).length) {
    const afectados = (await listTransactions())
      .filter((t) => cambios[t.categoria])
      .map((t) => ({ ...t, categoria: cambios[t.categoria] }));
    if (afectados.length) {
      await updateTransactionsBulk(afectados);
      migrados = afectados.length;
      cacheInvalidate("transactions");
    }
    await saveReglas(renombrarEnReglas(await listReglas(), cambios));
    const presupuestos = await getPresupuestos();
    if (Object.keys(cambios).some((v) => presupuestos[v])) {
      const nuevos = Object.fromEntries(Object.entries(presupuestos).map(([c, v]) => [cambios[c] ?? c, v]));
      await savePresupuestos(nuevos);
      cacheInvalidate("presupuestos");
    }
  }
  cacheInvalidate(CATEGORIAS_CACHE_KEY);
  return NextResponse.json({ ok: true, categorias, migrados });
});
