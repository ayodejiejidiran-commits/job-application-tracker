// Very simple in-memory rate limiter (per route + IP) for serverless runtimes.
// Note: For real production use Redis or Upstash. This is a lightweight example.

const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const bucket = hits.get(key);
  if (!bucket || bucket.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) {
    return { success: false, retryAfter: bucket.reset - now };
  }
  bucket.count += 1;
  return { success: true, remaining: limit - bucket.count };
}
