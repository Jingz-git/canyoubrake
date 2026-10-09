// Fixed follow-camera projection: all ground geometry uses the same mapping.
export function projectGround(distance, anchor, horizon = 18, depth = 36) {
  const q = depth / Math.max(4, depth + distance);
  return { y: horizon + (anchor - horizon) * q, scale: q };
}
