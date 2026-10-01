import { NextResponse } from "next/server";
import { listSueldos } from "@/lib/sheets";
import { cacheOrFetch } from "@/lib/cache";
import { SUELDOS_CACHE_KEY } from "@/lib/sueldos-sync";
import { withErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrors(async () => {
  const sueldos = await cacheOrFetch(SUELDOS_CACHE_KEY, () => listSueldos(), 3 * 60 * 1000);
  return NextResponse.json({ sueldos });
});
