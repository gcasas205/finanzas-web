import { NextResponse } from "next/server";
import { getInflacion } from "@/lib/inflacion";
import { AppError, withErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrors(async () => {
  try {
    return NextResponse.json({ serie: await getInflacion() });
  } catch {
    throw new AppError(503, "inflacion_unavailable", "No pudimos traer la inflación. Probá de nuevo en un rato.");
  }
});
