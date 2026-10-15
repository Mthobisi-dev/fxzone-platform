/** Prevents stale polling responses from overwriting navigation or local mutations. */
export class ChatRequestGuard {
  private conversationId: string | null = null;
  private revision = 0;

  activate(conversationId: string | null) {
    this.conversationId = conversationId;
    this.revision += 1;
  }

  isActive(conversationId: string) {
    return conversationId === this.conversationId;
  }

  invalidate(conversationId: string) {
    if (this.isActive(conversationId)) this.revision += 1;
  }

  begin(conversationId: string) {
    if (!this.isActive(conversationId)) return () => false;
    const revision = ++this.revision;
    return () => this.isActive(conversationId) && revision === this.revision;
  }
}
