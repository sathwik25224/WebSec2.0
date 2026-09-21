const buckets = new Map();
export function clientIp(request) { return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'; }
export function enforceRateLimitKey(key, limit, windowMs) {
  const now = Date.now(); const recent = (buckets.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) throw Error('Too many requests. Please wait and try again.');
  recent.push(now); buckets.set(key, recent);
}
export function enforceRateLimit(request, scope, limit, windowMs) {
  enforceRateLimitKey(`${scope}:${clientIp(request)}`, limit, windowMs);
}
