/**
 * Caché en memoria del servidor con TTL.
 * Sobrevive entre requests pero se resetea al reiniciar el server.
 * Ideal para evitar rate limits de Google Sheets API.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutos

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/** Invalida una key específica */
export function cacheInvalidate(key: string): void {
  store.delete(key);
}

/** Invalida todas las keys que empiecen con el prefijo */
export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/** Invalida todo el caché */
export function cacheClear(): void {
  store.clear();
}

/**
 * Helper: ejecuta fn() solo si el caché expiró.
 * Uso: const data = await cacheOrFetch("transactions", () => listTransactions());
 */
export async function cacheOrFetch<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  const data = await fn();
  cacheSet(key, data, ttlMs);
  return data;
}
