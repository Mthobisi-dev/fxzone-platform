type ConversationLike = {
  id: string;
  is_group?: boolean;
  isGroup?: boolean;
  members?: ReadonlyArray<string | { id?: string; user_id?: string }>;
};

export function canonicalDirectPair(firstUserId: string, secondUserId: string): [string, string] {
  const first = String(firstUserId || '').trim();
  const second = String(secondUserId || '').trim();
  if (!first || !second || first === second) throw new Error('Direct chats require two different users.');
  return [first, second].sort() as [string, string];
}

function directPairKey(conversation: ConversationLike): string | null {
  if ((conversation.is_group ?? conversation.isGroup) || !conversation.members || conversation.members.length !== 2) return null;
  const ids = conversation.members.map((member) => String(typeof member === 'string' ? member : member.id || member.user_id || (member as { userId?: string }).userId || '').trim());
  if (ids.some((id) => !id)) return null;
  return ids.sort().join(':');
}

/** Keep the first (already ordered) direct conversation for each participant pair. */
export function dedupeDirectConversations<T extends ConversationLike>(conversations: readonly T[]): T[] {
  const seen = new Set<string>();
  return conversations.filter((conversation) => {
    const key = directPairKey(conversation);
    if (!key || seen.has(key)) return !key;
    seen.add(key);
    return true;
  });
}

export function getConversationUnreadCount(conversations: ReadonlyArray<{ unreadCount?: unknown }>): number {
  return conversations.reduce((total, conversation) => {
    const count = Number(conversation.unreadCount);
    return total + (Number.isFinite(count) && count > 0 ? Math.floor(count) : 0);
  }, 0);
}

export function removeConversationById<T extends { id: string }>(
  conversations: readonly T[],
  conversationId: string,
): T[] {
  return conversations.filter((conversation) => String(conversation.id) !== String(conversationId));
}
