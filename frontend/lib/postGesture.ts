export interface TapPoint {
  at: number;
  x: number;
  y: number;
}

const MAX_DOUBLE_TAP_DELAY_MS = 320;
const MIN_DOUBLE_TAP_DELAY_MS = 40;
const MAX_DOUBLE_TAP_DISTANCE_PX = 28;
const MAX_TAP_TRAVEL_PX = 18;

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isPostTap(start: { x: number; y: number }, end: { x: number; y: number }) {
  return distance(start, end) <= MAX_TAP_TRAVEL_PX;
}

export function registerPostTap(previous: TapPoint | null, current: TapPoint) {
  const delay = previous ? current.at - previous.at : Number.POSITIVE_INFINITY;
  const isDoubleTap = Boolean(
    previous
      && delay >= MIN_DOUBLE_TAP_DELAY_MS
      && delay <= MAX_DOUBLE_TAP_DELAY_MS
      && distance(previous, current) <= MAX_DOUBLE_TAP_DISTANCE_PX
  );

  return { isDoubleTap, nextTap: isDoubleTap ? null : current };
}

export function galleryIndicators(count: number, activeIndex: number) {
  if (!Number.isInteger(count) || count <= 0) return [];
  return Array.from({ length: count }, (_, index) => index === activeIndex);
}

export function nextPostLikeState(current: boolean, forceLike: boolean) {
  return forceLike ? true : !current;
}
