import { NextResponse } from "next/server";
import { getAhorroConfig } from "@/lib/sheets";
import { cacheOrFetch } from "@/lib/cache";
import { withErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

const CACHE_KEY = "ahorro-config";
const CACHE_TTL = 2 * 60 * 1000; // 2 min: los parámetros cambian poco

export const GET = withErrors(async () => {
  const config = await cacheOrFetch(CACHE_KEY, () => getAhorroConfig(), CACHE_TTL);
  return NextResponse.json({ config });
});
