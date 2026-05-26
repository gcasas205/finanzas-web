import { NextRequest, NextResponse } from "next/server";
import { parseVisaPDF, parseSueldoPDF } from "@/lib/pdf-parser";
import { loadConfig, addTransactionsBulk, addSueldo } from "@/lib/sheets";
import { cacheInvalidate } from "@/lib/cache";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tipo = formData.get("tipo") as string;
    const action = formData.get("action") as string; // "preview" | "import"

    if (!file) {
      return NextResponse.json({ error: "Archivo no recibido" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const config = await loadConfig();

    if (tipo === "tarjeta") {
      const result = await parseVisaPDF(buffer, config.cardCutoffDay, config.cardDueDay);

      if (action === "import") {
        const imported = await addTransactionsBulk(result.transactions);
        cacheInvalidate("transactions"); // Refresh cache
        return NextResponse.json({ ok: true, imported, result });
      }

      return NextResponse.json({ ok: true, result });
    }

    if (tipo === "sueldo") {
      const result = await parseSueldoPDF(buffer, config.salaryPaymentOffsetMonths);

      if (action === "import") {
        await addSueldo(result.sueldo);
        if (result.ingresoTransaction) {
          await addTransactionsBulk([result.ingresoTransaction]);
        }
        cacheInvalidate("transactions"); // Refresh cache
        return NextResponse.json({ ok: true, result });
      }

      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: "Tipo no soportado" }, { status: 400 });
  } catch (e: any) {
    console.error("Error import-pdf:", e);
    return NextResponse.json(
      { error: e?.message || "Error desconocido" },
      { status: 500 }
    );
  }
}
