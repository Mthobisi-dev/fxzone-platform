/**
 * UI permission helpers for a live broadcast.
 *
 * These controls mirror the server-side session authorization: only the host
 * can publish capture media, while a platform administrator may end a room
 * when moderation requires it.
 */
export function canControlLiveBroadcastMedia(isHost: boolean): boolean {
  return isHost;
}

export type LiveSessionAdmissionRole = 'host' | 'viewer' | 'pending' | 'rejected' | null | undefined;

/** Only database-approved members may connect to the session's private topic. */
export function canEnterLiveBroadcastRoom(role: LiveSessionAdmissionRole): boolean {
  return role === 'host' || role === 'viewer';
}

export function getLiveSessionRoleLabel(role: LiveSessionAdmissionRole): string {
  if (role === 'host') return 'Host';
  if (role === 'viewer') return 'Viewer';
  if (role === 'pending') return 'Awaiting approval';
  if (role === 'rejected') return 'Access declined';
  return 'Not admitted';
}

export function canEndLiveBroadcast({
  isHost,
  isAdmin,
}: {
  isHost: boolean;
  isAdmin: boolean;
}): boolean {
  return isHost || isAdmin;
}
