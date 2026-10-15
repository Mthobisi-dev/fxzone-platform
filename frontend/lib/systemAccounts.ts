const HIDDEN_PUBLIC_USERNAMES = new Set(['jackbot_analyst']);

export function isHiddenSystemAccount(username: unknown): boolean {
  return typeof username === 'string' && HIDDEN_PUBLIC_USERNAMES.has(username.trim().toLowerCase());
}
