'use client';

import React, { useState, useEffect } from 'react';
import { ChatSidebar, Conversation, SuggestedUser } from '@/components/chat/ChatSidebar';
import { ChatWindow, ChatMessage } from '@/components/chat/ChatWindow';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { api } from '@/lib/api';
import { Loader2, MessageSquare, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [targetUsername, setTargetUsername] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [startingUserId, setStartingUserId] = useState<string | null>(null);

  // States for user selection modal
  const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Group creation modal states
  const [modalTab, setModalTab] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // WebSocket hook for real-time chat sync
  const socketRef = useWebSocket(
    activeConvId ? `/ws/chat/${activeConvId}` : '',
    {
      open: () => {
        setWsConnected(true);
      },
      close: () => {
        setWsConnected(false);
      },
      error: () => {
        setWsConnected(false);
      },
      message: (payload) => {
        const msg = payload;
        const convId = msg.conversation_id || msg.conversationId;
        const senderId = msg.sender_id || msg.senderId;

        if (String(senderId) === String(user?.id)) return;

        if (String(convId) === String(activeConvId)) {
          setMessages((prev) => {
            // Deduplicate: skip if already exists
            if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
            return [
              ...prev,
              {
                id: msg.id,
                conversationId: convId,
                senderId: senderId,
                content: msg.content,
                createdAt: msg.created_at || msg.createdAt,
                sender: msg.sender,
              },
            ];
          });
        }

        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(convId)
              ? {
                  ...c,
                  unreadCount: String(c.id) !== String(activeConvId) ? c.unreadCount + 1 : 0,
                  lastMessage: { content: msg.content, createdAt: msg.created_at || msg.createdAt },
                }
              : c
          )
        );
      },
    }
  );

  const fetchConversations = async () => {
    try {
      const response = await api.get('/api/chat/conversations');
      if (Array.isArray(response)) {
        const mapped = response.map((c: any) => ({
          id: c.id,
          name: c.name,
          isGroup: c.is_group ?? c.isGroup ?? false,
          unreadCount: c.unreadCount || 0,
          createdAt: c.created_at || c.createdAt,
          updatedAt: c.updated_at || c.updatedAt,
          members: Array.isArray(c.members)
            ? c.members.map((m: any) => ({
                userId: m.id || m.userId,
                username: m.username,
                displayName: m.display_name || m.displayName || m.username,
                avatarUrl: m.avatar_url || m.avatarUrl,
              }))
            : [],
        }));
        setConversations(mapped);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const response = await api.get(`/api/chat/conversations/${convId}/messages`);
      if (Array.isArray(response)) {
        const mapped = response.map((m: any) => ({
          id: m.id,
          conversationId: m.conversation_id || m.conversationId,
          senderId: m.sender_id || m.senderId,
          content: m.content,
          messageType: m.message_type || m.messageType || 'text',
          createdAt: m.created_at || m.createdAt,
          sender: m.sender
            ? {
                username: m.sender.username,
                displayName: m.sender.display_name || m.sender.displayName || m.sender.username,
                avatarUrl: m.sender.avatar_url || m.sender.avatarUrl,
              }
            : undefined,
        }));
        setMessages((prev) => {
          const pending = prev.filter((m) => String(m.id).startsWith('temp-'));
          const confirmedIds = new Set(mapped.map((m: any) => String(m.id)));
          const remainingPending = pending.filter((m) => !confirmedIds.has(String(m.id)));
          return [...mapped, ...remainingPending];
        });
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEligibleUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await api.get('/api/social/users?limit=100');
      if (Array.isArray(response)) {
        // Allow messaging any user except current user and FxZone Bot
        const filtered = response.filter(
          (u: any) => u.id !== user?.id && u.username !== 'fxzone_bot' && u.email !== 'bot@fxzone.com'
        );
        setEligibleUsers(filtered);
      }
    } catch (err) {
      console.error('Failed to load eligible users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchConversations().then(() => {
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const conv = searchParams.get('conv');
        if (conv) {
          setActiveConvId(conv);
        }
      }
    });
    // Fetch eligible users on page load so the People tab is ready
    fetchEligibleUsers();
  }, [user]);

  // Periodic sidebar sync: refresh conversation list every 4 seconds to catch new groups & messages
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Track whether WS connected successfully
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
      setWsConnected(false);
      // Mark read
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, unreadCount: 0 } : c))
      );
    }
  }, [activeConvId]);

  // Active chat message polling: sync messages every 2.5 seconds to guarantee message delivery
  useEffect(() => {
    if (!activeConvId) return;
    const interval = setInterval(() => {
      fetchMessages(activeConvId);
    }, 2500);
    return () => clearInterval(interval);
  }, [activeConvId]);

  useEffect(() => {
    if (newChatOpen) {
      fetchEligibleUsers();
    }
  }, [newChatOpen]);

  const handleSendMessage = async (text: string) => {
    if (!activeConvId || !user) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      conversationId: activeConvId,
      senderId: String(user.id),
      content: text,
      createdAt: new Date().toISOString(),
      sender: {
        username: user.username,
        displayName: user.display_name || user.username,
        avatarUrl: user.avatar_url,
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(activeConvId)
          ? { ...c, lastMessage: { content: text, createdAt: optimisticMsg.createdAt } }
          : c
      )
    );

    try {
      const res = await api.post(`/api/chat/conversations/${activeConvId}/messages`, {
        content: text,
        message_type: 'text',
      });
      if (res && res.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? {
            ...m,
            id: res.id,
            createdAt: res.created_at || res.createdAt || m.createdAt,
          } : m))
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  // Start chat directly using selected User object/ID (works from sidebar People tab AND modal)
  const handleStartChatWithUser = async (targetUser: any) => {
    if (creatingChat) return;

    setCreatingChat(true);
    setStartingUserId(targetUser.id);

    try {
      const response = await api.post('/api/chat/conversations', {
        participant_ids: [targetUser.id],
        is_group: false,
      });
      if (response && response.id) {
        setNewChatOpen(false);
        await fetchConversations();
        setActiveConvId(response.id);
      }
    } catch (err) {
      console.error('Failed to create chat with selected user:', err);
    } finally {
      setCreatingChat(false);
      setStartingUserId(null);
    }
  };

  const handleCreateChatManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim() || creatingChat) return;
    setCreatingChat(true);

    try {
      const response = await api.post('/api/chat/conversations', {
        username: targetUsername.trim(),
      });
      if (response && response.id) {
        setTargetUsername('');
        setNewChatOpen(false);
        await fetchConversations();
        setActiveConvId(response.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingChat(false);
    }
  };

  const toggleGroupMember = (userId: string) => {
    setSelectedGroupMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroupChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedGroupMembers.length === 0 || creatingGroup) return;
    setCreatingGroup(true);

    try {
      const response = await api.post('/api/chat/conversations', {
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        participant_ids: selectedGroupMembers,
        is_group: true,
      });
      if (response && response.id) {
        setGroupName('');
        setGroupDescription('');
        setSelectedGroupMembers([]);
        setNewChatOpen(false);
        await fetchConversations();
        setActiveConvId(response.id);
      }
    } catch (err) {
      console.error('Failed to create group chat:', err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const activeConv = conversations.find((c) => String(c.id) === String(activeConvId));
  const activeDetails = activeConv
    ? activeConv.isGroup
      ? { name: activeConv.name || 'Group Chat', avatarUrl: undefined, isGroup: true }
      : {
          name:
            activeConv.members.find((m) => String(m.userId || (m as any).id) !== String(user?.id))?.displayName ||
            activeConv.members.find((m) => String(m.userId || (m as any).id) !== String(user?.id))?.username ||
            'Direct Message',
          avatarUrl: activeConv.members.find((m) => String(m.userId || (m as any).id) !== String(user?.id))?.avatarUrl,
          isGroup: false,
        }
    : null;

  // Filter list by search query
  const filteredUsers = eligibleUsers.filter((u) => {
    const term = userSearch.toLowerCase();
    const displayNameVal = u.displayName || u.display_name || '';
    return (
      u.username.toLowerCase().includes(term) ||
      displayNameVal.toLowerCase().includes(term)
    );
  });

  const handleStartLiveCall = async () => {
    if (!activeConvId || !user || !activeDetails) return;
    try {
      const response = await api.post('/api/sessions', {
        title: `1-on-1 Call with ${activeDetails.name}`,
        description: `Private direct trading session between ${user.display_name || user.username} and ${activeDetails.name}`,
      });
      if (response && response.id) {
        const inviteText = `[Live Session] (id: ${response.id}) (title: 1-on-1 Call with ${user.display_name || user.username})`;
        await handleSendMessage(inviteText);
        router.push(`/session/${response.id}`);
      }
    } catch (err) {
      console.error('Failed to create 1-on-1 session:', err);
    }
  };

  return (
    <div className="h-[calc(100vh-64px-32px)] flex overflow-hidden">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : (
        <>
          {/* Sidebar */}
          <ChatSidebar
            conversations={conversations}
            suggestedUsers={eligibleUsers}
            loadingSuggested={loadingUsers}
            activeId={activeConvId}
            onSelectConversation={setActiveConvId}
            onStartChatWithUser={handleStartChatWithUser}
            startingChatUserId={startingUserId}
            onNewChat={() => {
              setModalTab('direct');
              setNewChatOpen(true);
            }}
            currentUserId={user?.id || ''}
          />

          {/* Active Window */}
          {activeConvId && activeDetails ? (
            <ChatWindow
              messages={messages}
              currentUserId={user?.id || ''}
              conversationName={activeDetails.name}
              conversationAvatar={activeDetails.avatarUrl}
              isGroup={activeDetails.isGroup}
              members={activeConv?.members || []}
              conversationData={activeConv}
              onSendMessage={handleSendMessage}
              onStartLiveCall={handleStartLiveCall}
            />
          ) : (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center select-none bg-zinc-950/20">
              <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-550 mb-3 animate-pulse">
                <MessageSquare size={20} />
              </div>
              <h4 className="text-xs font-bold text-zinc-300">Terminal Messages</h4>
              <p className="text-[10px] text-zinc-500 max-w-[200px] mt-1 leading-relaxed">
                Select an active operator conversation or start a new direct channel.
              </p>
            </div>
          )}
        </>
      )}

      {/* New Chat Modal */}
      {newChatOpen && (
        <Modal
          isOpen={newChatOpen}
          onClose={() => setNewChatOpen(false)}
          title="Start Conversation"
        >
          <div className="space-y-4 select-none">
            {/* Tab switch between Direct Message and Create Group Chat */}
            <div className="flex border-b border-zinc-800 pb-2 gap-2">
              <button
                type="button"
                onClick={() => setModalTab('direct')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  modalTab === 'direct'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <MessageSquare size={13} />
                <span>Direct Message</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('group')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  modalTab === 'group'
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Users size={13} />
                <span>Create Group Chat</span>
              </button>
            </div>

            {modalTab === 'direct' ? (
              /* ─── DIRECT MESSAGE TAB ─── */
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Select an operator</label>
                  
                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search operator by name or handle..."
                      className="w-full h-8 pl-8 pr-3 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  {loadingUsers ? (
                    <div className="h-32 flex items-center justify-center">
                      <Loader2 className="animate-spin text-blue-500" size={16} />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20 text-zinc-500 text-[10px] italic">
                      {userSearch ? 'No matching operators found.' : 'No operators found.'}
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => handleStartChatWithUser(u)}
                          className="w-full p-2 hover:bg-zinc-900/60 border border-transparent hover:border-zinc-850 rounded-xl flex items-center justify-between cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar name={u.displayName || u.display_name || u.username} src={u.avatarUrl || u.avatar_url} size="sm" className="h-8 w-8" />
                            <div>
                              <span className="text-[11px] font-bold text-white block leading-tight">{u.displayName || u.display_name || u.username}</span>
                              <span className="text-[9px] text-zinc-550 block">@{u.username}</span>
                            </div>
                          </div>
                          
                          <span className="text-[8px] bg-blue-600/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white border border-blue-500/20 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider transition-all select-none">
                            Chat
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-850 my-2 pt-2 text-center text-[9px] text-zinc-550">
                  OR ENTER USERNAME MANUALLY
                </div>

                <form onSubmit={handleCreateChatManual} className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={targetUsername}
                      onChange={(e) => setTargetUsername(e.target.value)}
                      placeholder="Enter exact operator username... (e.g. alpha_trader)"
                      className="w-full h-8 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-zinc-700"
                      required
                      disabled={creatingChat}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => setNewChatOpen(false)} disabled={creatingChat}>
                      Cancel
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-500" type="submit" disabled={creatingChat || !targetUsername.trim()}>
                      {creatingChat ? 'Connecting...' : 'Start Chat'}
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              /* ─── CREATE GROUP CHAT TAB ─── */
              <form onSubmit={handleCreateGroupChat} className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Group Name *</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Gold Traders VIP Circle"
                    className="w-full h-8 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                    required
                    disabled={creatingGroup}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="e.g. Daily market analysis and strategy discussion"
                    className="w-full h-8 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                    disabled={creatingGroup}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] text-zinc-400">Select Members *</label>
                    <span className="text-[9px] text-purple-400 font-semibold">
                      {selectedGroupMembers.length} selected
                    </span>
                  </div>

                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search operators to add..."
                      className="w-full h-7 pl-8 pr-3 bg-zinc-950 border border-zinc-850 rounded-lg text-[11px] text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  {loadingUsers ? (
                    <div className="h-28 flex items-center justify-center">
                      <Loader2 className="animate-spin text-purple-500" size={16} />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-4 text-center border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20 text-zinc-500 text-[10px] italic">
                      No operators found.
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1 divide-y divide-zinc-850/40">
                      {filteredUsers.map((u) => {
                        const isSelected = selectedGroupMembers.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => toggleGroupMember(u.id)}
                            className={`w-full p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected ? 'bg-purple-950/40 border border-purple-800/40' : 'hover:bg-zinc-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar name={u.displayName || u.display_name || u.username} src={u.avatarUrl || u.avatar_url} size="sm" className="h-7 w-7" />
                              <div>
                                <span className="text-[11px] font-bold text-white block leading-tight">
                                  {u.displayName || u.display_name || u.username}
                                </span>
                                <span className="text-[9px] text-zinc-550 block">@{u.username}</span>
                              </div>
                            </div>

                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-0 cursor-pointer h-4 w-4"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
                  <Button size="sm" variant="ghost" onClick={() => setNewChatOpen(false)} disabled={creatingGroup}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5"
                    type="submit"
                    disabled={creatingGroup || !groupName.trim() || selectedGroupMembers.length === 0}
                  >
                    {creatingGroup ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Creating Group...</span>
                      </>
                    ) : (
                      <>
                        <Users size={12} />
                        <span>Create Group ({selectedGroupMembers.length})</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
