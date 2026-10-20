export interface DeletableChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
}

export const CHAT_MAX_MESSAGE_LENGTH = 4_000;

export function isValidChatMessageContent(content: unknown): content is string {
  return typeof content === 'string' && content.trim().length > 0;
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
