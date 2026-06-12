type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const TTL_MS = 45_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, CacheEntry<unknown>>();

const pruneCache = () => {
  const now = Date.now();

  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }

  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
};

export const getCachedDashboardValue = async <T>(
  key: string,
  factory: () => Promise<T>
): Promise<T> => {
  pruneCache();

  const cached = cache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await factory();
  cache.set(key, {
    expiresAt: Date.now() + TTL_MS,
    value,
  });

  return value;
};

export const clearDashboardCacheForTest = () => {
  cache.clear();
};
