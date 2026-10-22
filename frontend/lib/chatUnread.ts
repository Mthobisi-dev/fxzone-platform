export interface ChatUnreadConversation {
  id: string;
  unread_count?: number | null;
}

export interface ChatUnreadNotification {
  type?: string;
  is_read?: boolean;
  data?: {
    conversation_id?: unknown;
  };
}

/**
 * Returns one badge unit per conversation with unread messages.
 *
 * Conversation rows and message notifications are both populated by the
 * realtime path. Counting both sources directly makes a single unread chat
 * appear twice in the footer, so their conversation ids are merged here.
 * Notifications without a conversation id are counted individually because
 * they cannot be safely associated with a conversation.
 */
export function getChatUnreadBadgeCount(
  conversations: ChatUnreadConversation[],
  notifications: ChatUnreadNotification[],
): number {
  const conversationIds = new Set<string>();

  for (const conversation of conversations) {
    if (conversation.unread_count && conversation.unread_count > 0 && conversation.id) {
      conversationIds.add(conversation.id);
    }
  }

  let unscopedNotifications = 0;
  for (const notification of notifications) {
    if (notification.type !== 'message' || notification.is_read) continue;
    const conversationId = notification.data?.conversation_id;
    if (typeof conversationId === 'string' && conversationId.length > 0) {
      conversationIds.add(conversationId);
    } else {
      unscopedNotifications += 1;
    }
  }

  return conversationIds.size + unscopedNotifications;
}
