const DEFAULT_DESTINATION = '/dashboard';

function validHttpOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function safeOAuthDestination(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_DESTINATION;
  return value;
}

export function buildOAuthRedirectUrl(
  browserOrigin: string,
  configuredSiteUrl?: string,
  destination = DEFAULT_DESTINATION
): string {
  const origin = validHttpOrigin(configuredSiteUrl) ?? validHttpOrigin(browserOrigin);
  if (!origin) throw new Error('A valid application URL is required for Google sign-in.');
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', safeOAuthDestination(destination));
  return callback.toString();
}
