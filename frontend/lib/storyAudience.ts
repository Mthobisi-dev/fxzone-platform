interface OutgoingFollow {
  following_id: string;
}

interface IncomingFollow {
  follower_id: string;
}

/** Stories are private to their author and people who mutually follow them. */
export function storyAudienceIds(
  viewerId: string,
  outgoing: OutgoingFollow[],
  incoming: IncomingFollow[],
): string[] {
  const followers = new Set(incoming.map((follow) => follow.follower_id));
  const mutualIds = outgoing
    .map((follow) => follow.following_id)
    .filter((id) => id !== viewerId && followers.has(id));
  return [viewerId, ...Array.from(new Set(mutualIds))];
}
