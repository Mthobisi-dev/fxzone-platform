export function mutualConnectionIds(viewer: string, outgoing: { following_id: string }[], incoming: { follower_id: string }[]): string[] {
  const followers = new Set(incoming.map(row => row.follower_id));
  return Array.from(new Set(outgoing.map(row => row.following_id).filter(id => id !== viewer && followers.has(id))));
}
