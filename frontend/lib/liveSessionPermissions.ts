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

export function canEndLiveBroadcast({
  isHost,
  isAdmin,
}: {
  isHost: boolean;
  isAdmin: boolean;
}): boolean {
  return isHost || isAdmin;
}
