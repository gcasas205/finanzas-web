import { NextResponse } from "next/server";
import { parseVisaPDF, parseSueldoPDF } from "@/lib/pdf-parser";
import { loadConfig, addTransactionsBulk, addSueldo, listTransactions } from "@/lib/sheets";
import { expandirCuotas } from "@/lib/cuotas";
import { separarDuplicados } from "@/lib/duplicados";
import { SUELDOS_CACHE_KEY } from "@/lib/sueldos-sync";
import { generateId } from "@/lib/utils";
import { cacheInvalidate } from "@/lib/cache";
import { TransactionImportSchema } from "@/lib/validations";
import { buildTransaction } from "@/lib/transactions";
import { AppError, withErrors } from "@/lib/errors";
import type { AppConfig, Transaction } from "@/types";

export const dynamic = "force-dynamic";

/** Un PDF que no se puede leer es un problema del archivo, no del servidor. */
async function parsePdf<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[api] import-pdf: no se pudo leer el PDF:", e);
    throw new AppError(422, "unreadable_pdf", "No pudimos leer el PDF. Revisá que sea el resumen o recibo correcto.", "file");
  }
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB: un resumen o recibo pesa mucho menos

/** Valida la lista revisada que manda la vista previa. Nunca se escribe sin validar. */
function parseEditedTransactions(raw: string, config: AppConfig): Transaction[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AppError(400, "invalid_json", "La lista de movimientos revisados no es válida");
  }
  const parsed = TransactionImportSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const [fila, campo] = issue.path;
    const prefijo = typeof fila === "number" ? `Fila ${fila + 1}: ` : "";
    throw new AppError(400, "validation", `${prefijo}${issue.message}`, typeof campo === "string" ? campo : undefined);
  }
  return parsed.data.map((t) => buildTransaction(t, config));
}

/**
 * Para cada consumo en cuotas del resumen, arma las cuotas que faltan (una por mes)
 * salvo las que ya estén en la planilla (ej. generadas por un resumen anterior).
 */
async function cuotasFuturas(txs: Transaction[]): Promise<Transaction[]> {
  if (!txs.some((t) => t.cuotaTotal > 1 && t.cuotaNumero < t.cuotaTotal)) return [];
  const futuras: Transaction[] = [];
  for (let i = 0; i < txs.length; i++) {
    const grupo = generateId();
    const [primera, ...resto] = expandirCuotas(txs[i], grupo, generateId);
    txs[i] = primera; // la cuota del resumen también queda en el grupo
    futuras.push(...resto);
  }
  return separarDuplicados(futuras, await listTransactions()).nuevos;
}

export const POST = withErrors(async (req) => {
  const formData = await req.formData();
  const file = formData.get("file");
  const tipo = formData.get("tipo");
  const action = formData.get("action"); // "preview" | "import"

  if (!(file instanceof File)) throw new AppError(400, "validation", "No recibimos el archivo", "file");
  if (file.size > MAX_BYTES) throw new AppError(413, "file_too_large", "El archivo supera los 10 MB", "file");
  const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!esPdf) throw new AppError(415, "unsupported_type", "Sólo se pueden importar archivos PDF", "file");
  if (tipo !== "tarjeta" && tipo !== "sueldo") throw new AppError(400, "validation", "Tipo de documento no soportado", "tipo");

  const buffer = Buffer.from(await file.arrayBuffer());
  const config = await loadConfig();

  if (tipo === "tarjeta") {
    const result = await parsePdf(() => parseVisaPDF(buffer, config.cardCutoffDay, config.cardDueDay));
    if (action !== "import") return NextResponse.json({ ok: true, result });

    // Si el cliente mandó la lista revisada (editada/filtrada), se usa esa;
    // si no, se importa lo parseado tal cual.
    const edited = formData.get("transactions");
    const toImport = typeof edited === "string" ? parseEditedTransactions(edited, config) : result.transactions;
    const futuras = await cuotasFuturas(toImport); // también agrupa las de toImport
    const imported = await addTransactionsBulk([...toImport, ...futuras]);
    cacheInvalidate("transactions");
    return NextResponse.json({ ok: true, imported, result });
  }

  const result = await parsePdf(() => parseSueldoPDF(buffer, config.salaryPaymentOffsetMonths));
  if (action !== "import") return NextResponse.json({ ok: true, result });

  // El sueldo queda vinculado a su movimiento: editarlo o borrarlo lo mantiene al día
  await addSueldo({ ...result.sueldo, txId: result.ingresoTransaction?.id });
  if (result.ingresoTransaction) await addTransactionsBulk([result.ingresoTransaction]);
  cacheInvalidate("transactions");
  cacheInvalidate(SUELDOS_CACHE_KEY);
  return NextResponse.json({ ok: true, imported: 1, result });
});
