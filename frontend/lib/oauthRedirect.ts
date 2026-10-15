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
  // PKCE verifiers are scoped to the browser origin that starts the flow. Keep
  // the callback on that same origin (including Vercel preview deployments),
  // otherwise the callback cannot read the verifier written before redirecting
  // to Google. The configured site remains a fallback for non-browser callers.
  const origin = validHttpOrigin(browserOrigin) ?? validHttpOrigin(configuredSiteUrl);
  if (!origin) throw new Error('A valid application URL is required for Google sign-in.');
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', safeOAuthDestination(destination));
  return callback.toString();
}
