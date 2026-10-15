export function normalizeDiscoverQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function shouldSearchDiscover(value: string): boolean {
  return value.length >= 2;
}
