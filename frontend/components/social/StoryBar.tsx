'use client';

import React, { useState, useEffect } from 'react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Plus, X, ArrowLeft, ArrowRight, Upload, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Modal } from '../ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';

export interface Story {
  id: string;
  userId: string;
  user: {
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  content: string;
  imageUrl?: string;
  createdAt: string;
  expiresAt: string;
}

export function StoryBar() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryGroup, setActiveStoryGroup] = useState<Story[] | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);

  const fetchStories = async () => {
    try {
      const response = await api.get('/api/social/stories');
      if (Array.isArray(response)) {
        const mapped: Story[] = response.map((s: any) => ({
          id: String(s.id),
          userId: String(s.userId || s.user_id || (s.user ? (s.user.id || s.user.userId) : '')),
          user: {
            username: s.user?.username || 'trader',
            displayName: s.user?.displayName || s.user?.display_name || s.user?.username || 'Trader',
            avatarUrl: s.user?.avatarUrl || s.user?.avatar_url,
          },
          content: s.content || '',
          imageUrl: s.imageUrl || s.image_url,
          createdAt: s.createdAt || s.created_at,
          expiresAt: s.expiresAt || s.expires_at,
        }));
        setStories(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch stories:', err);
    }
  };

  useEffect(() => {
    fetchStories();
    const handleRefresh = () => fetchStories();
    window.addEventListener('fxzone_refresh_stories', handleRefresh);
    window.addEventListener('fxzone_refresh_feed', handleRefresh);
    return () => {
      window.removeEventListener('fxzone_refresh_stories', handleRefresh);
      window.removeEventListener('fxzone_refresh_feed', handleRefresh);
    };
  }, []);

  // Group stories by user so clicking displays user's full sequence of stories
  const groupedStories = stories.reduce((acc, story) => {
    const uKey = story.userId || 'anon';
    if (!acc[uKey]) {
      acc[uKey] = [];
    }
    acc[uKey].push(story);
    return acc;
  }, {} as Record<string, Story[]>);

  const handleCreateStory = async () => {
    if (!newContent.trim() && !newImageUrl.trim() && !storyFile) return;
    setPublishing(true);
    try {
      let imageUrl = newImageUrl.trim() || null;

      // If a file was selected, upload it first
      if (storyFile) {
        const formData = new FormData();
        formData.append('file', storyFile);
        const uploadRes = await api.post('/api/social/posts/upload', formData);
        if (uploadRes?.url) {
          imageUrl = uploadRes.url;
        }
      }

      await api.post('/api/social/stories', {
        content: newContent.trim() || 'Live Setup',
        image_url: imageUrl,
        is_story: true,
      });
      setNewContent('');
      setNewImageUrl('');
      setStoryFile(null);
      setCreating(false);
      await fetchStories();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fxzone_refresh_stories'));
        window.dispatchEvent(new CustomEvent('fxzone_refresh_feed'));
      }
    } catch (err) {
      console.error('Failed to create story:', err);
    } finally {
      setPublishing(false);
    }
  };

  const openStoryViewer = (userId: string) => {
    const userStories = groupedStories[userId];
    if (userStories && userStories.length > 0) {
      setActiveStoryGroup(userStories);
      setActiveStoryIdx(0);
    }
  };

  const nextStory = () => {
    if (!activeStoryGroup) return;
    if (activeStoryIdx < activeStoryGroup.length - 1) {
      setActiveStoryIdx(activeStoryIdx + 1);
    } else {
      setActiveStoryGroup(null);
    }
  };

  const prevStory = () => {
    if (activeStoryIdx > 0) {
      setActiveStoryIdx(activeStoryIdx - 1);
    }
  };

  // Preview URL for the selected file
  const filePreviewUrl = storyFile ? URL.createObjectURL(storyFile) : null;

  return (
    <div className="flex gap-4 items-center bg-zinc-950/20 border border-zinc-850 p-3 rounded-xl overflow-x-auto select-none no-scrollbar">
      {/* Create Story Button */}
      <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={() => setCreating(true)}>
        <div className="h-12 w-12 rounded-full border border-dashed border-zinc-700 bg-zinc-900/50 hover:bg-zinc-850 transition-colors flex items-center justify-center text-zinc-400 hover:text-white">
          <Plus size={16} />
        </div>
        <span className="text-[9px] font-semibold text-zinc-400">Add Story</span>
      </div>

      {/* Stories Loop grouped by user */}
      {Object.keys(groupedStories).map((userId) => {
        const userStories = groupedStories[userId];
        const primaryStory = userStories[0];
        return (
          <div
            key={userId}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
            onClick={() => openStoryViewer(userId)}
          >
            {/* Circle Avatar with Active neon gradient border */}
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-blue-500 animate-gradient hover:scale-105 transition-transform duration-200">
              <div className="p-0.5 bg-zinc-950 rounded-full">
                <Avatar
                  src={primaryStory.user.avatarUrl}
                  alt={primaryStory.user.username}
                  size="md"
                  className="rounded-full h-11 w-11 object-cover"
                />
              </div>
            </div>
            <span className="text-[9px] font-medium text-zinc-300 truncate max-w-[56px]">
              {primaryStory.user.displayName || primaryStory.user.username}
            </span>
          </div>
        );
      })}

      {/* Story Composition Modal */}
      {creating && (
        <Modal isOpen={creating} onClose={() => { setCreating(false); setStoryFile(null); }} title="Create Day Story">
          <div className="space-y-4">
            {/* Image Preview */}
            {(filePreviewUrl || newImageUrl.trim()) && (
              <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                <img
                  src={filePreviewUrl || newImageUrl.trim()}
                  alt="Story preview"
                  className="w-full h-48 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <button
                  onClick={() => { setStoryFile(null); setNewImageUrl(''); }}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div>
              <label className="text-[10px] text-purple-300 font-semibold block mb-1">Story Caption & Description</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Add a caption, technical note, or signal to your story (e.g. 'Gold breakout on 4H chart 🚀')..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none"
              />
            </div>

            {/* Upload Section */}
            <div className="flex gap-2">
              <label className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-850 transition-colors group">
                <Upload size={14} className="text-zinc-500 group-hover:text-purple-400 transition-colors" />
                <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300">
                  {storyFile ? storyFile.name : 'Upload Image'}
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setStoryFile(e.target.files[0]);
                      setNewImageUrl('');
                    }
                  }}
                />
              </label>
              <div className="text-[10px] text-zinc-600 flex items-center px-2">or</div>
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => { setNewImageUrl(e.target.value); setStoryFile(null); }}
                placeholder="Paste image URL..."
                className="flex-1 h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-750"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setStoryFile(null); }} disabled={publishing}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-500"
                onClick={handleCreateStory}
                disabled={publishing || (!newContent.trim() && !newImageUrl.trim() && !storyFile)}
              >
                {publishing ? 'Publishing...' : 'Share Story'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Story Viewer Overlay */}
      <AnimatePresence>
        {activeStoryGroup && (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center select-none">
            <button
              onClick={() => setActiveStoryGroup(null)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="relative w-full max-w-sm aspect-[9/16] bg-zinc-950 rounded-2xl border border-zinc-850 overflow-hidden flex flex-col justify-between shadow-2xl">
              {/* Progress Bar Indicators */}
              <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
                {activeStoryGroup.map((_, i) => (
                  <div key={i} className="h-1 bg-zinc-800 rounded-full flex-1 overflow-hidden">
                    <div
                      className={`h-full bg-purple-500 transition-all duration-300 ${
                        i < activeStoryIdx
                          ? 'w-full'
                          : i === activeStoryIdx
                          ? 'w-full animate-[progress_5s_linear_forward]'
                          : 'w-0'
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* User Bar */}
              <div className="absolute top-6 left-3 right-3 flex justify-between items-center z-20 bg-gradient-to-b from-black/60 to-transparent p-2 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <Avatar
                    src={activeStoryGroup[activeStoryIdx].user.avatarUrl}
                    alt="Author"
                    size="sm"
                  />
                  <div>
                    <span className="text-[10px] font-bold text-white block leading-tight">
                      {activeStoryGroup[activeStoryIdx].user.displayName || activeStoryGroup[activeStoryIdx].user.username}
                    </span>
                    <span className="text-[8px] text-zinc-400">
                      @{activeStoryGroup[activeStoryIdx].user.username}
                    </span>
                  </div>
                </div>
              </div>

              {/* Story Content View */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                {activeStoryGroup[activeStoryIdx].imageUrl ? (
                  <img
                    src={activeStoryGroup[activeStoryIdx].imageUrl}
                    alt="Story image"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-purple-950 to-pink-950" />
                )}
                
                {/* Story Text content (with background block if image) */}
                <div className="z-10 bg-black/45 backdrop-blur-md border border-white/10 p-4 rounded-xl max-w-[85%] text-center text-sm font-semibold text-white leading-relaxed shadow-lg">
                  {activeStoryGroup[activeStoryIdx].content}
                </div>
              </div>

              {/* Navigation overlays */}
              <div className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer flex items-center pl-2" onClick={prevStory}>
                {activeStoryIdx > 0 && (
                  <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
                    <ArrowLeft size={16} />
                  </div>
                )}
              </div>
              <div className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer flex items-center justify-end pr-2" onClick={nextStory}>
                <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
