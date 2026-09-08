export interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

const store: RateLimitStore = {};
const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 5;

export async function rateLimit(key: string): Promise<{ allowed: boolean; resetAt: number }> {
  const now = Date.now();
  const windowMs = WINDOW_SECONDS * 1000;

  if (!store[key] || store[key].resetAt < now) {
    store[key] = { count: 1, resetAt: now + windowMs };
    return { allowed: true, resetAt: store[key].resetAt };
  }

  store[key].count += 1;
  if (store[key].count > MAX_ATTEMPTS) {
    return { allowed: false, resetAt: store[key].resetAt };
  }

  return { allowed: true, resetAt: store[key].resetAt };
}
