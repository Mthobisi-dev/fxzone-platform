'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { PostCard, Post } from '@/components/social/PostCard';
import { CheckCircle2, UserPlus, UserMinus, Loader2, Sparkles, Edit3, Camera } from 'lucide-react';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const params = useParams();
  const { user: currentUser } = useAuth();
  const userId = params.id as string;

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'about'>('posts');

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
    setLoading(true);
    try {
      const response = await api.get(`/api/social/users/${userId}`);
      if (response) {
        setProfile(response);
      }
      
      const userPosts = await api.get(`/api/social/users/${userId}/posts`);
      if (Array.isArray(userPosts)) {
        setPosts(userPosts);
      }
    } catch (err) {
      console.error('Failed to load profile details:', err);
      setProfile({
        id: userId,
        username: 'analyst_pro',
        displayName: 'Technical FX Analyst',
        avatarUrl: undefined,
        role: 'analyst',
        bio: 'Senior currency strategist focusing on G10 forex setups.',
        followersCount: 1420,
        followingCount: 380,
        isFollowing: false,
      });
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const handleFollowToggle = async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    const prevFollowing = profile.isFollowing;
    
    setProfile((prev: any) => ({
      ...prev,
      isFollowing: !prevFollowing,
      followersCount: prevFollowing ? prev.followersCount - 1 : prev.followersCount + 1,
    }));

    try {
      await api.post(`/api/social/users/${userId}/follow`, {});
    } catch (err) {
      console.error(err);
      setProfile((prev: any) => ({
        ...prev,
        isFollowing: prevFollowing,
        followersCount: prevFollowing ? prev.followersCount + 1 : prev.followersCount - 1,
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
      await api.put('/api/auth/me', {
        username: editUsername.trim() || undefined,
        display_name: editDisplayName.trim() || undefined,
        bio: editBio.trim() || undefined,
        avatar_url: finalAvatarUrl || undefined,
      });
      setEditModalOpen(false);
      setAvatarFile(null);
      fetchProfile();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setSaveError(err?.detail || 'Failed to save profile. Username may already be taken.');
    } finally {
      setSaving(false);
    }
  };

  const isSelf = currentUser?.id === userId;

  if (loading && !profile) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={24} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 select-none">
      {/* Cover Header Card */}
      <Card className="border border-zinc-900 bg-zinc-950/40 overflow-hidden relative">
        {/* Banner area */}
        <div className="h-32 bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-pink-900/40 relative">
          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[8px] bg-black/60 border border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
            FxZone Verified
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
            
            <div className="mb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-bold text-white leading-none">
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
                className="h-8 text-xs font-semibold px-4 flex items-center gap-1.5"
              >
                <Edit3 size={12} />
                <span>Edit Profile</span>
              </Button>
            ) : profile?.username !== 'fxzone_bot' && profile?.role !== 'bot' ? (
              <Button
                onClick={handleFollowToggle}
                variant={profile?.isFollowing ? 'outline' : 'primary'}
                className="h-8 text-xs font-semibold px-4 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500"
                disabled={followLoading}
              >
                {followLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : profile?.isFollowing ? (
                  <>
                    <UserMinus size={12} />
                    <span>Unfollow</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={12} />
                    <span>Follow</span>
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Biography and Stats Summary */}
        <div className="px-6 pb-6 pt-2 border-t border-zinc-900/60 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="max-w-md">
            <p className="text-xs text-zinc-400 leading-relaxed">{profile?.bio || 'No biography configured.'}</p>
          </div>
          
          <div className="flex gap-6 shrink-0 pt-1">
            <div>
              <span className="text-xs font-bold text-zinc-200 block leading-tight">{posts.length}</span>
              <span className="text-[9px] text-zinc-500 font-medium">Ideas</span>
            </div>
            {profile?.username !== 'fxzone_bot' && profile?.role !== 'bot' && (
              <>
                <div>
                  <span className="text-xs font-bold text-zinc-200 block leading-tight">{profile?.followersCount || profile?.followers_count || 0}</span>
                  <span className="text-[9px] text-zinc-500 font-medium">Followers</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-200 block leading-tight">{profile?.followingCount || profile?.following_count || 0}</span>
                  <span className="text-[9px] text-zinc-500 font-medium">Following</span>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-zinc-900 select-none pb-1">
        <button
          onClick={() => setActiveTab('posts')}
          className={`text-xs font-bold pb-2 transition-colors border-b-2 -mb-[9px] px-2 ${
            activeTab === 'posts' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Trading Ideas
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`text-xs font-bold pb-2 transition-colors border-b-2 -mb-[9px] px-2 ${
            activeTab === 'about' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          About Operator
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'posts' ? (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-900 rounded-xl bg-zinc-950/10">
              <p className="text-xs text-zinc-500 italic">No trading ideas have been posted yet.</p>
            </div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      ) : (
        <Card className="p-6 border border-zinc-900 bg-zinc-950/20 space-y-4">
          <div>
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Network Role Details</h4>
            <span className="text-xs font-semibold text-white capitalize flex items-center gap-1.5">
              <Sparkles size={13} className="text-purple-400" /> {profile?.role?.replace('_', ' ')}
            </span>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">About</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">{profile?.bio || 'No bio set.'}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Username</h4>
            <span className="text-xs text-zinc-300">@{profile?.username}</span>
          </div>
        </Card>
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
            {/* Username */}
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Username</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Your unique username"
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>
            {/* Display Name */}
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Display Name (Real Name)</label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Your real name"
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>
            {/* Bio */}
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">About Operator</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Tell others about your trading style..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
              />
            </div>
            {/* Error Display */}
            {saveError && (
              <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{saveError}</p>
            )}
            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Are you absolutely sure you want to delete your account? All your posts, comments, messages, and profile data will be permanently purged!')) {
                    try {
                      await api.delete('/api/social/users/me');
                      window.location.href = '/';
                    } catch (err) {
                      alert('Failed to delete account. Please try again.');
                    }
                  }
                }}
                className="text-[10px] text-red-500 hover:text-red-400 font-bold underline"
              >
                Delete Account
              </button>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditModalOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
