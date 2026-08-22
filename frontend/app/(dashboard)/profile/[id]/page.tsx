'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { PostCard, Post } from '@/components/social/PostCard';
import {
  CheckCircle2,
  UserPlus,
  UserMinus,
  Loader2,
  Sparkles,
  Edit3,
  Camera,
  MessageSquare,
  Bookmark,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: currentUser, logout } = useAuth();
  const rawId = params.id as string;
  const targetId = rawId === 'me' && currentUser?.id ? String(currentUser.id) : rawId;
  const isSelf = Boolean(
    currentUser &&
    (String(currentUser.id) === targetId ||
      currentUser.username === targetId ||
      rawId === 'me')
  );

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'about'>('posts');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete account state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (searchParams?.get('action') === 'delete') {
      setDeleteModalOpen(true);
    }
  }, [searchParams]);

  const fetchSavedPosts = async () => {
    setLoadingSaved(true);
    try {
      const res = await api.get('/api/social/posts/saved');
      if (Array.isArray(res)) {
        const mapped = res.map((p: any) => ({
          id: String(p.id),
          userId: String(p.user_id || p.userId),
          user: {
            id: String(p.user?.id || p.user_id || p.userId),
            username: p.user?.username || '',
            displayName:
              p.user?.display_name ||
              p.user?.displayName ||
              p.user?.username ||
              '',
            avatarUrl: p.user?.avatar_url || p.user?.avatarUrl,
            role: p.user?.role || 'trader',
          },
          content: p.content,
          imageUrl: p.image_url || p.imageUrl,
          assetTags: p.asset_tags || p.assetTags || [],
          likesCount: p.likes_count ?? p.likesCount ?? 0,
          commentsCount: p.comments_count ?? p.commentsCount ?? 0,
          repostsCount: p.reposts_count ?? p.repostsCount ?? 0,
          showCommentsCount: p.show_comments_count ?? p.showCommentsCount ?? true,
          showLikesCount: p.show_likes_count ?? p.showLikesCount ?? true,
          allowReshare: p.allow_reshare ?? p.allowReshare ?? true,
          allowSave: p.allow_save ?? p.allowSave ?? true,
          allowShare: p.allow_share ?? p.allowShare ?? true,
          isLikedByUser: p.is_liked_by_user ?? p.isLikedByUser ?? false,
          isRepostedByUser: p.is_reposted_by_user ?? p.isRepostedByUser ?? false,
          isBookmarkedByUser: true,
          isPinned: p.is_pinned ?? p.isPinned ?? false,
          createdAt: p.created_at || p.createdAt || new Date().toISOString(),
        }));

        const unique = Array.from(new Map(mapped.map((p: any) => [String(p.id), p])).values());
        setSavedPosts(unique as Post[]);
      }
    } catch (e) {
      console.error('Failed to load saved posts:', e);
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    if (isSelf) {
      fetchSavedPosts();
    }
  }, [isSelf]);

  useEffect(() => {
    if (activeTab === 'saved') {
      fetchSavedPosts();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleSavedRefresh = () => {
      fetchSavedPosts();
    };
    window.addEventListener('fxzone_refresh_saved_posts', handleSavedRefresh);
    window.addEventListener('fxzone_refresh_feed', handleSavedRefresh);
    return () => {
      window.removeEventListener('fxzone_refresh_saved_posts', handleSavedRefresh);
      window.removeEventListener('fxzone_refresh_feed', handleSavedRefresh);
    };
  }, []);

  // Edit profile state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saveError, setSaveError] = useState('');

  const fetchProfile = async () => {
    if (!targetId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await api.get(`/api/social/users/${targetId}`);
      if (response && response.id) {
        setProfile(response);
      }
      
      const userPosts = await api.get(`/api/social/users/${targetId}/posts`);
      if (Array.isArray(userPosts)) {
        const mapped = userPosts.map((p: any) => ({
          id: String(p.id),
          userId: String(p.user_id || p.userId),
          user: {
            id: String(p.user?.id || p.user_id || p.userId),
            username: p.user?.username || '',
            displayName:
              p.user?.display_name ||
              p.user?.displayName ||
              p.user?.username ||
              '',
            avatarUrl: p.user?.avatar_url || p.user?.avatarUrl,
            role: p.user?.role || 'trader',
          },
          content: p.content,
          imageUrl: p.image_url || p.imageUrl,
          assetTags: p.asset_tags || p.assetTags || [],
          likesCount: p.likes_count ?? p.likesCount ?? 0,
          commentsCount: p.comments_count ?? p.commentsCount ?? 0,
          repostsCount: p.reposts_count ?? p.repostsCount ?? 0,
          showCommentsCount: p.show_comments_count ?? p.showCommentsCount ?? true,
          showLikesCount: p.show_likes_count ?? p.showLikesCount ?? true,
          allowReshare: p.allow_reshare ?? p.allowReshare ?? true,
          allowSave: p.allow_save ?? p.allowSave ?? true,
          allowShare: p.allow_share ?? p.allowShare ?? true,
          isLikedByUser: p.is_liked_by_user ?? p.isLikedByUser ?? false,
          isRepostedByUser: p.is_reposted_by_user ?? p.isRepostedByUser ?? false,
          isBookmarkedByUser: p.is_bookmarked_by_user ?? p.isBookmarkedByUser ?? false,
          isPinned: p.is_pinned ?? p.isPinned ?? false,
          createdAt: p.created_at || p.createdAt || new Date().toISOString(),
        }));
        const unique = Array.from(new Map(mapped.map((p: any) => [String(p.id), p])).values());
        setPosts(unique as Post[]);
      }
    } catch (err: any) {
      console.error('Failed to load profile details:', err);
      // If user is viewing their own profile via fallback
      if (
        currentUser &&
        (String(currentUser.id) === targetId ||
          currentUser.username === targetId ||
          targetId === 'me')
      ) {
        setProfile({
          id: String(currentUser.id),
          username: currentUser.username,
          displayName: currentUser.display_name || currentUser.username,
          avatarUrl: currentUser.avatar_url,
          role: currentUser.role || 'trader',
          bio: currentUser.bio || 'FxZone Trader',
          followersCount: (currentUser as any)?.followers_count || 0,
          followingCount: (currentUser as any)?.following_count || 0,
          isFollowing: false,
        });
      } else {
        setErrorMsg('User profile not found or unavailable.');
        setProfile(null);
      }
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    const handleRefresh = () => {
      fetchProfile();
    };
    window.addEventListener('fxzone_refresh_feed', handleRefresh);
    window.addEventListener('fxzone_refresh_saved_posts', handleRefresh);
    return () => {
      window.removeEventListener('fxzone_refresh_feed', handleRefresh);
      window.removeEventListener('fxzone_refresh_saved_posts', handleRefresh);
    };
  }, [targetId]);

  const handleFollowToggle = async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    const prevFollowing = profile.isFollowing;
    
    setProfile((prev: any) => ({
      ...prev,
      isFollowing: !prevFollowing,
      followersCount: prevFollowing
        ? Math.max(0, (prev.followersCount || 1) - 1)
        : (prev.followersCount || 0) + 1,
    }));

    try {
      const res = await api.post(`/api/social/users/${profile.id || targetId}/follow`, {});
      if (res) {
        setProfile((prev: any) => ({
          ...prev,
          isFollowing: res.is_following,
          followersCount: res.followers_count ?? prev.followersCount,
          followingCount: res.following_count ?? prev.followingCount,
        }));
      }
    } catch (err) {
      console.error(err);
      setProfile((prev: any) => ({
        ...prev,
        isFollowing: prevFollowing,
        followersCount: prevFollowing
          ? (prev.followersCount || 0) + 1
          : Math.max(0, (prev.followersCount || 1) - 1),
      }));
    } finally {
      setFollowLoading(false);
    }
  };

  const openEditModal = () => {
    setEditUsername(profile?.username || '');
    setEditDisplayName(profile?.displayName || profile?.display_name || '');
    setEditBio(profile?.bio || '');
    setEditAvatarUrl(profile?.avatarUrl || profile?.avatar_url || '');
    setSaveError('');
    setAvatarFile(null);
    setEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError('');
    try {
      let finalAvatarUrl = editAvatarUrl;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const uploadRes = await api.post('/api/social/posts/upload', formData);
        if (uploadRes?.url) {
          finalAvatarUrl = uploadRes.url;
        }
      }

      const res = await api.put('/api/auth/me', {
        username: editUsername.trim() || undefined,
        display_name: editDisplayName.trim() || undefined,
        bio: editBio.trim() || undefined,
        avatar_url: finalAvatarUrl || undefined,
      });

      setProfile((prev: any) => ({
        ...prev,
        username: res.username || editUsername,
        displayName: res.display_name || editDisplayName,
        bio: res.bio || editBio,
        avatarUrl: res.avatar_url || finalAvatarUrl,
      }));

      setEditModalOpen(false);
      fetchProfile();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setSaveError(err?.detail || 'Failed to save profile. Username may already be taken.');
    } finally {
      setSaving(false);
    }
  };

  const [startingChat, setStartingChat] = useState(false);

  const handleDirectMessage = async () => {
    if (startingChat || !profile?.id) return;
    setStartingChat(true);
    try {
      const response = await api.post('/api/chat/conversations', {
        participant_ids: [profile.id],
        is_group: false,
      });
      if (response?.id) {
        router.push(`/chat?conv=${response.id}`);
      } else {
        router.push('/chat');
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
      router.push('/chat');
    } finally {
      setStartingChat(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      alert('Please type "delete" to confirm account deletion.');
      return;
    }
    setDeletingAccount(true);
    try {
      // Execute account deletion
      await api.delete('/api/auth/me').catch(() => api.delete('/api/social/users/me'));
      logout();
      window.location.href = '/login';
    } catch (err: any) {
      console.error('Account deletion error:', err);
      alert(err?.detail || err?.message || 'Failed to delete account. Please try again.');
      setDeletingAccount(false);
    }
  };

  const handlePostDeleted = (deletedId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
    setSavedPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  if (loading && !profile) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={24} />
      </div>
    );
  }

  if (errorMsg && !profile) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto mt-12 border border-dashed border-zinc-850 rounded-2xl bg-zinc-950/40 space-y-4">
        <p className="text-sm text-zinc-400 font-semibold">{errorMsg}</p>
        <Button
          onClick={() => router.push('/discover')}
          className="bg-blue-600 hover:bg-blue-500 text-xs font-bold px-4"
        >
          Discover Other Traders
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 select-none">
      {/* Cover Header Card */}
      <Card className="border border-zinc-900 bg-zinc-950/40 overflow-hidden relative rounded-2xl">
        {/* Banner area */}
        <div className="h-32 bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-pink-900/40 relative">
          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[8px] bg-black/60 border border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
            FxZone Trader Profile
          </div>
        </div>

        {/* Profile Avatar and Metadata */}
        <div className="p-6 relative flex flex-col sm:flex-row justify-between items-start sm:items-end -mt-10 gap-4">
          <div className="flex gap-4 items-end">
            <div className="p-1 bg-zinc-950 rounded-full border-2 border-zinc-800 shrink-0">
              <Avatar
                src={profile?.avatarUrl || profile?.avatar_url}
                alt={profile?.username}
                className="h-20 w-20 rounded-full object-cover"
              />
            </div>
            
            <div className="mb-2 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-bold text-white leading-none truncate">
                  {profile?.displayName || profile?.display_name || profile?.username}
                </h3>
                {(profile?.role === 'verified_educator' || profile?.role === 'analyst') && (
                  <CheckCircle2 size={12} className="text-blue-500 fill-blue-500/10" />
                )}
              </div>
              <span className="text-[10px] text-zinc-500 block mt-0.5">@{profile?.username}</span>
            </div>
          </div>

          <div className="flex gap-2 self-stretch sm:self-auto justify-end mb-2">
            {isSelf ? (
              <Button
                onClick={openEditModal}
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold flex items-center gap-1.5 border-zinc-850 hover:border-zinc-700 bg-zinc-900"
              >
                <Edit3 size={13} />
                <span>Edit Profile</span>
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleDirectMessage}
                  disabled={startingChat}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold flex items-center gap-1.5 border-zinc-850 hover:border-zinc-700 bg-zinc-900"
                >
                  <MessageSquare size={13} className="text-blue-400" />
                  <span>{startingChat ? 'Connecting...' : 'Direct Chat'}</span>
                </Button>

                <Button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  size="sm"
                  className={`h-8 text-xs font-bold px-4 flex items-center gap-1.5 ${
                    profile?.isFollowing
                      ? 'bg-zinc-800 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/30 text-zinc-300'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {followLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : profile?.isFollowing ? (
                    <>
                      <UserMinus size={13} />
                      <span>Unfollow</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={13} />
                      <span>Follow</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Bio & Stats Bar */}
        <div className="px-6 pb-6 pt-0 border-t border-zinc-900 mt-2">
          {profile?.bio && (
            <p className="text-xs text-zinc-300 leading-relaxed my-3">{profile.bio}</p>
          )}

          <div className="flex gap-6 mt-4 pt-3 border-t border-zinc-900/60 text-xs">
            <div>
              <span className="font-bold text-white block">
                {profile?.followersCount ?? profile?.followers_count ?? 0}
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Followers</span>
            </div>
            <div>
              <span className="font-bold text-white block">
                {profile?.followingCount ?? profile?.following_count ?? 0}
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Following</span>
            </div>
            <div>
              <span className="font-bold text-white block">{posts.length}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Posts</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-850 pb-2">
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'posts'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          Shared Analysis ({posts.length})
        </button>

        {isSelf && (
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'saved'
                ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            <Bookmark size={12} />
            <span>Saved Posts ({savedPosts.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('about')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'about'
              ? 'bg-purple-600/15 text-purple-400 border border-purple-500/20'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          About Trader
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'posts' ? (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20">
              <p className="text-xs text-zinc-500 italic">No trading ideas have been posted yet.</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onDelete={handlePostDeleted} />
            ))
          )}
        </div>
      ) : activeTab === 'saved' ? (
        <div className="space-y-4">
          {loadingSaved ? (
            <div className="py-12 flex justify-center text-xs text-zinc-500">
              <Loader2 className="animate-spin text-purple-500" size={20} />
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20">
              <p className="text-xs text-zinc-500 italic">
                No saved posts found. Bookmark market setups to access them here!
              </p>
            </div>
          ) : (
            savedPosts.map((post) => (
              <PostCard key={post.id} post={post} onDelete={handlePostDeleted} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="p-6 border border-zinc-900 bg-zinc-950/20 space-y-4 rounded-xl">
            <div>
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                Network Role Details
              </h4>
              <span className="text-xs font-semibold text-white capitalize flex items-center gap-1.5">
                <Sparkles size={13} className="text-purple-400" /> {profile?.role?.replace('_', ' ')}
              </span>
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                About
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed">{profile?.bio || 'No bio set.'}</p>
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                Username
              </h4>
              <span className="text-xs text-zinc-300">@{profile?.username}</span>
            </div>
          </Card>

          {/* Danger Zone: Delete Account */}
          {isSelf && (
            <Card className="p-6 border border-rose-900/30 bg-rose-950/10 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle size={16} />
                <h4 className="text-xs font-bold uppercase tracking-wider">Danger Zone</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Permanently delete your FxZone account, profile, posts, comments, direct messages, and all associated trading data. This action is irreversible.
              </p>
              <div className="pt-1">
                <Button
                  onClick={() => setDeleteModalOpen(true)}
                  size="sm"
                  className="bg-rose-700/80 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 border border-rose-600/30"
                >
                  <Trash2 size={13} />
                  <span>Delete My Account</span>
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Your Profile">
          <div className="space-y-4">
            {/* Avatar Section */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar
                  src={avatarFile ? URL.createObjectURL(avatarFile) : editAvatarUrl}
                  alt="Preview"
                  className="h-16 w-16 rounded-full"
                />
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Camera size={16} className="text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setAvatarFile(e.target.files[0]);
                    }}
                  />
                </label>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-zinc-400">Click avatar to upload a new photo</p>
                <input
                  type="text"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="Or paste image URL..."
                  className="w-full h-7 mt-1 bg-zinc-950 border border-zinc-850 rounded px-2 text-[10px] text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                />
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">Display Name</label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Your trading persona name"
                className="w-full h-8 bg-zinc-950 border border-zinc-850 rounded px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">Bio & Strategies</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Short bio, experience, favorite currency pairs, or analysis methodologies..."
                className="w-full h-20 bg-zinc-950 border border-zinc-850 rounded p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
              />
            </div>

            {saveError && (
              <p className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded">
                {saveError}
              </p>
            )}

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => {
                  setEditModalOpen(false);
                  setDeleteModalOpen(true);
                }}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 hover:underline"
              >
                <Trash2 size={12} /> Delete Account
              </button>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 font-bold text-xs"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving Changes...' : 'Save Profile'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Account Confirmation Modal */}
      {deleteModalOpen && (
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => {
            if (!deletingAccount) {
              setDeleteModalOpen(false);
              setDeleteConfirmText('');
            }
          }}
          title="Delete Account Permanently"
        >
          <div className="space-y-4">
            <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <AlertTriangle size={16} />
                <span>Permanent Data Purge</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                This will permanently delete your user account <strong>@{profile?.username}</strong>, your published technical posts, comments, private chat messages, active sessions, and bookmarks. This operation cannot be undone.
              </p>
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                To confirm, type <span className="text-rose-400 font-bold font-mono">delete</span> below:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete"
                className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500"
                disabled={deletingAccount}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
                disabled={deletingAccount}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs"
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || deletingAccount}
                onClick={handleDeleteAccount}
              >
                {deletingAccount ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Purging Account...
                  </span>
                ) : (
                  'Permanently Delete Account'
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
