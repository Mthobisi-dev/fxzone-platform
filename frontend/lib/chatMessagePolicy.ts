export interface DeletableChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
}

/** A user may delete only their own message from the requested conversation. */
export function canDeleteMessage(
  message: DeletableChatMessage | null | undefined,
  userId: string,
  conversationId: string,
): boolean {
  return Boolean(
    message &&
    message.id &&
    String(message.sender_id) === String(userId) &&
    String(message.conversation_id) === String(conversationId),
  );
}
