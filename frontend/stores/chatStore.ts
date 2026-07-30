import { create } from 'zustand';
import { api } from '@/lib/api';
import { UserShort } from './socialStore';

export interface Conversation {
  id: string;
  name?: string;
  is_group: boolean;
  created_at: string;
  updated_at: string;
  members: UserShort[];
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender: UserShort;
  content: string;
  message_type: string;
  created_at: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  error: string | null;
  typingUsers: Record<string, string[]>;

  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string, limit?: number, offset?: number) => Promise<void>;
  createConversation: (participantIds: string[], isGroup?: boolean, name?: string) => Promise<Conversation>;
  setActiveConversationId: (conversationId: string | null) => void;
  receiveMessage: (message: Message) => void;
  setTypingUser: (conversationId: string, username: string, isTyping: boolean) => void;
  clearUnread: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isLoading: false,
  error: null,
  typingUsers: {},

  fetchConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get('/api/chat/conversations');
      set({ conversations: data, isLoading: false });
    } catch (err: any) {
      set({
        error: err.detail || 'Failed to fetch conversations.',
        isLoading: false,
      });
    }
  },

  fetchMessages: async (conversationId, limit = 50, offset = 0) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get(`/api/chat/conversations/${conversationId}/messages`, {
        params: { limit, offset },
      });
      
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: offset === 0 ? data : [...data, ...(state.messages[conversationId] || [])],
        },
        isLoading: false,
      }));
    } catch (err: any) {
      set({
        error: err.detail || 'Failed to retrieve messages.',
        isLoading: false,
      });
    }
  },

  createConversation: async (participantIds, isGroup = false, name) => {
    set({ isLoading: true, error: null });
    try {
      const conv = await api.post('/api/chat/conversations', {
        participant_ids: participantIds,
        is_group: isGroup,
        name: name || null,
      });

      set((state) => ({
        conversations: [conv, ...state.conversations],
        isLoading: false,
      }));

      return conv;
    } catch (err: any) {
      set({
        error: err.detail || 'Failed to initiate conversation.',
        isLoading: false,
      });
      throw err;
    }
  },

  setActiveConversationId: (conversationId) => {
    set({ activeConversationId: conversationId });
    if (conversationId) {
      get().clearUnread(conversationId);
    }
  },

  receiveMessage: (message) => {
    const convId = message.conversation_id;
    
    // Append message to message list
    set((state) => {
      const list = state.messages[convId] || [];
      // Prevent duplicate messages
      if (list.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [convId]: [...list, message],
        },
      };
    });

    // Bring conversation to top and increment unread count if not active
    set((state) => {
      const isActive = state.activeConversationId === convId;
      const index = state.conversations.findIndex((c) => c.id === convId);
      
      if (index === -1) {
        // Conversation not loaded yet, refetch conversations
        get().fetchConversations();
        return state;
      }

      const updatedConversations = [...state.conversations];
      const conv = { ...updatedConversations[index] };
      
      if (!isActive) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
      
      conv.updated_at = message.created_at;
      
      // Move to top of the array
      updatedConversations.splice(index, 1);
      updatedConversations.unshift(conv);
      
      return { conversations: updatedConversations };
    });
  },

  setTypingUser: (conversationId, username, isTyping) => {
    set((state) => {
      const activeTyping = state.typingUsers[conversationId] || [];
      let newTyping;
      
      if (isTyping) {
        if (activeTyping.includes(username)) return state;
        newTyping = [...activeTyping, username];
      } else {
        newTyping = activeTyping.filter((name) => name !== username);
      }
      
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: newTyping,
        },
      };
    });
  },

  clearUnread: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id === conversationId) {
          return { ...c, unread_count: 0 };
        }
        return c;
      }),
    }));
  },
}));
