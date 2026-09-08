import { NextResponse } from "next/server";
import { getAhorroConfig } from "@/lib/sheets";
import { cacheOrFetch } from "@/lib/cache";

const CACHE_KEY = "ahorro-config";
const CACHE_TTL = 2 * 60 * 1000; // 2 min: los parámetros cambian poco

export async function GET() {
  const config = await cacheOrFetch(CACHE_KEY, () => getAhorroConfig(), CACHE_TTL);
  return NextResponse.json({ config });
}