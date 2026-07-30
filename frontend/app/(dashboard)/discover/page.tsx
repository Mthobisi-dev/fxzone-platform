'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import {
  Search,
  UserPlus,
  UserMinus,
  MessageCircle,
  Users,
  Loader2,
  Sparkles,
  Shield,
  TrendingUp,
  X,
  Check,
} from 'lucide-react';

interface DiscoverUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  followers_count: number;
  is_following: boolean;
  is_follower?: boolean;
  is_mutual?: boolean;
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  // Group creation state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<DiscoverUser[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const fetchUsers = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('limit', '30');
      const response = await api.get(`/api/social/users?${params.toString()}`);
      if (Array.isArray(response)) {
        setUsers(response.filter((u: DiscoverUser) => u.id !== user?.id));
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const handleFollow = async (targetUser: DiscoverUser) => {
    setFollowLoading(targetUser.id);
    try {
      await api.post(`/api/social/users/${targetUser.id}/follow`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? {
                ...u,
                is_following: !u.is_following,
                followers_count: u.is_following
                  ? u.followers_count - 1
                  : u.followers_count + 1,
              }
            : u
        )
      );
    } catch (err) {
      console.error('Follow toggle failed:', err);
    } finally {
      setFollowLoading(null);
    }
  };

  const handleStartDM = async (targetUser: DiscoverUser) => {
    try {
      const response = await api.post('/api/chat/conversations', {
        participant_ids: [targetUser.id],
        name: null,
        is_group: false,
      });
      if (response?.id) {
        window.location.href = `/chat?conv=${response.id}`;
      }
    } catch (err) {
      console.error('Failed to start DM:', err);
      // Navigate to chat page anyway
      window.location.href = '/chat';
    }
  };

  const toggleGroupMember = (targetUser: DiscoverUser) => {
    setSelectedMembers((prev) => {
      const exists = prev.find((m) => m.id === targetUser.id);
      if (exists) return prev.filter((m) => m.id !== targetUser.id);
      return [...prev, targetUser];
    });
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMembers.length < 1 || !groupName.trim() || creatingGroup) return;
    setCreatingGroup(true);

    try {
      const response = await api.post('/api/chat/conversations', {
        participant_ids: selectedMembers.map((m) => m.id),
        name: groupName.trim(),
        is_group: true,
      });
      if (response?.id) {
        window.location.href = `/chat?conv=${response.id}`;
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setCreatingGroup(false);
      setGroupModalOpen(false);
      setGroupName('');
      setSelectedMembers([]);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'verified_educator':
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20">
            <Shield size={8} /> Educator
          </span>
        );
      case 'analyst':
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
            <TrendingUp size={8} /> Analyst
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
            <Sparkles size={8} /> Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            Trader
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles size={20} className="text-blue-400" />
            Discover Traders
          </h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Find and follow top traders, analysts, and educators to grow your network.
          </p>
        </div>

        <Button
          onClick={() => setGroupModalOpen(true)}
          size="sm"
          className="h-8 px-3 text-[10px] flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500"
        >
          <Users size={12} />
          Create Group
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search traders by username or display name..."
          className="w-full h-10 bg-zinc-900/60 border border-zinc-850 rounded-xl pl-9 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
        />
      </div>

      {/* User grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-xs text-zinc-500">
            No traders found{search ? ` matching "${search}"` : ''}. Try a different search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((u) => (
            <Card
              key={u.id}
              className="p-4 border border-zinc-850 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  src={u.avatar_url || undefined}
                  name={u.display_name || u.username}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs font-bold text-white truncate">
                      {u.display_name || u.username}
                    </h3>
                    {getRoleBadge(u.role)}
                    {u.is_mutual && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        Mutual Follow
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 truncate">@{u.username}</p>
                  {u.bio && (
                    <p className="text-[10px] text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {u.bio}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[9px] text-zinc-500">
                      <strong className="text-zinc-300">{u.followers_count}</strong> followers
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-850/50">
                <Button
                  onClick={() => handleFollow(u)}
                  size="sm"
                  variant={u.is_following ? 'ghost' : 'primary'}
                  className={`flex-1 h-7 text-[10px] flex items-center justify-center gap-1 ${
                    u.is_following
                      ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800'
                      : 'bg-blue-600/80 hover:bg-blue-500 text-white'
                  }`}
                  disabled={followLoading === u.id}
                >
                  {followLoading === u.id ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : u.is_following ? (
                    <UserMinus size={10} />
                  ) : (
                    <UserPlus size={10} />
                  )}
                  {u.is_following ? 'Unfollow' : 'Follow'}
                </Button>

                <Button
                  onClick={() => handleStartDM(u)}
                  size="sm"
                  variant="ghost"
                  className={`h-7 px-2 text-[10px] border border-zinc-800 hover:bg-zinc-800/50 ${
                    u.is_following || u.is_follower
                      ? 'text-zinc-400 hover:text-white'
                      : 'text-zinc-600 opacity-40 cursor-not-allowed'
                  }`}
                  disabled={!(u.is_following || u.is_follower)}
                  title={u.is_following || u.is_follower ? 'Start Direct Message' : 'Follow relationship required to chat'}
                >
                  <MessageCircle size={12} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {groupModalOpen && (
        <Modal
          isOpen={groupModalOpen}
          onClose={() => {
            setGroupModalOpen(false);
            setSelectedMembers([]);
            setGroupName('');
          }}
          title="Create Group Chat"
        >
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., EURUSD Trading Circle"
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1.5">
                Select Members ({selectedMembers.length} selected - Follows Only)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-zinc-850 rounded-lg p-2 bg-zinc-950/50">
                {users.filter((u) => u.is_following || u.is_follower).map((u) => {
                  const isSelected = selectedMembers.some((m) => m.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleGroupMember(u)}
                      className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-600/10 border border-blue-500/30'
                          : 'hover:bg-zinc-900 border border-transparent'
                      }`}
                    >
                      <Avatar
                        src={u.avatar_url || undefined}
                        name={u.display_name || u.username}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-white truncate">
                          {u.display_name || u.username}
                        </p>
                        <p className="text-[9px] text-zinc-500">@{u.username}</p>
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-300 font-medium"
                  >
                    {m.display_name || m.username}
                    <button
                      type="button"
                      onClick={() => toggleGroupMember(m)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setGroupModalOpen(false);
                  setSelectedMembers([]);
                  setGroupName('');
                }}
                disabled={creatingGroup}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500"
                type="submit"
                disabled={selectedMembers.length < 1 || !groupName.trim() || creatingGroup}
              >
                {creatingGroup ? (
                  <>
                    <Loader2 size={10} className="animate-spin mr-1" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Users size={10} className="mr-1" />
                    Create Group ({selectedMembers.length + 1} members)
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
