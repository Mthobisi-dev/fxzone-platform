interface ThreadMessage {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
}

interface MessagePreview {
  content: string;
  createdAt: string;
}

/** Replace a fetched thread without discarding other threads or pending sends. */
export function mergeConversationMessages<T extends ThreadMessage>(
  previous: readonly T[],
  confirmed: readonly T[],
  conversationId: string,
): T[] {
  const confirmedIds = new Set(confirmed.map((message) => message.id));
  const pending = previous.filter((message) => message.conversationId === conversationId
    && message.id.startsWith('temp-') && !confirmedIds.has(message.id));
  return [...previous.filter((message) => message.conversationId !== conversationId), ...confirmed, ...pending];
}

/** An empty fetched thread clears its preview; an unfetched one keeps its summary. */
export function getConversationPreview(
  messages: readonly ThreadMessage[],
  conversationId: string,
  hasLoaded: boolean,
  fallback?: MessagePreview,
): MessagePreview | undefined {
  const thread = messages.filter((message) => message.conversationId === conversationId);
  const lastMessage = thread[thread.length - 1];
  return lastMessage
    ? { content: lastMessage.content, createdAt: lastMessage.createdAt }
    : hasLoaded ? undefined : fallback;
}
