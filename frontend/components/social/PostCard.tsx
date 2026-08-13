'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Heart, MessageSquare, Repeat2, Bookmark, Share2, Tag, CheckCircle2, Trash2, Pin, Clock, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export interface Post {
  id: string;
  userId: string;
  user: {
    id?: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    role: string;
  };
  content: string;
  imageUrl?: string;
  assetTags: string[];
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  isLikedByUser?: boolean;
  isRepostedByUser?: boolean;
  isBookmarkedByUser?: boolean;
  isPinned?: boolean;
  isStory?: boolean;
  expiresAt?: string;
  createdAt: string;
}

interface PostCardProps {
  post: Post;
  onSelect?: (post: Post) => void;
  onTagClick?: (tag: string) => void;
  onDelete?: (postId: string) => void;
}

export function PostCard({ post, onSelect, onTagClick, onDelete }: PostCardProps) {
  const { user } = useAuth();

  const raw = post as any;
  const userId = post.userId || raw.user_id;
  const postUser = {
    id: post.user?.id || raw.user?.id || userId,
    username: post.user?.username || raw.user?.username || 'trader',
    displayName: post.user?.displayName || raw.user?.display_name || raw.user?.displayName || post.user?.username || raw.user?.username || 'Trader',
    avatarUrl: post.user?.avatarUrl || raw.user?.avatar_url || raw.user?.avatarUrl,
    role: post.user?.role || raw.user?.role || 'trader',
  };

  const imageUrl = post.imageUrl || raw.image_url;
  const assetTags = post.assetTags || raw.asset_tags || [];
  const likesCount = post.likesCount ?? raw.likes_count ?? 0;
  const commentsCount = post.commentsCount ?? raw.comments_count ?? 0;
  const repostsCount = post.repostsCount ?? raw.reposts_count ?? 0;
  const isLikedByUser = post.isLikedByUser ?? raw.is_liked_by_user ?? false;
  const isRepostedByUser = post.isRepostedByUser ?? raw.is_reposted_by_user ?? false;
  const isBookmarkedByUser = post.isBookmarkedByUser ?? raw.is_bookmarked_by_user ?? false;
  const createdAt = post.createdAt || raw.created_at;

  const [likes, setLikes] = useState(likesCount);
  const [isLiked, setIsLiked] = useState(!!isLikedByUser);
  const [reposts, setReposts] = useState(repostsCount);
  const [isReposted, setIsReposted] = useState(!!isRepostedByUser);
  const [isBookmarked, setIsBookmarked] = useState(!!isBookmarkedByUser);
  const isPinned = post.isPinned ?? raw.is_pinned ?? false;
  const [pinned, setPinned] = useState(!!isPinned);
  const isStory = post.isStory ?? raw.is_story ?? false;
  const expiresAt = post.expiresAt || raw.expires_at;
  const isBot = postUser.username === 'fxzone_bot' || postUser.role === 'bot';

  const [deleting, setDeleting] = useState(false);
  const isOwner = String(user?.id) === String(userId) || String(user?.id) === String(postUser.id);
  const canDelete = true; // Allow users to delete posts directly from feed

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = !pinned;
    setPinned(newPinned);
    try {
      await api.post(`/api/social/posts/${post.id}/pin`, {});
      // Refresh feed if callback provided
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fxzone_refresh_feed'));
      }
    } catch (err) {
      console.error('Failed to pin post:', err);
      setPinned(!newPinned);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this post?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/social/posts/${post.id}`);
      onDelete?.(post.id);
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert('Could not delete post.');
      setDeleting(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikes((prev) => (newLiked ? prev + 1 : prev - 1));

    try {
      await api.post(`/api/social/posts/${post.id}/react`, { reaction_type: 'like' });
    } catch (err) {
      console.error('Like toggle error:', err);
      // Revert if error
      setIsLiked(!newLiked);
      setLikes((prev) => (!newLiked ? prev + 1 : prev - 1));
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newReposted = !isReposted;
    setIsReposted(newReposted);
    setReposts((prev) => (newReposted ? prev + 1 : prev - 1));

    try {
      await api.post(`/api/social/posts/${post.id}/repost`, {});
    } catch (err) {
      console.error('Repost error:', err);
      // Revert
      setIsReposted(!newReposted);
      setReposts((prev) => (!newReposted ? prev + 1 : prev - 1));
    }
  };

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState<any[]>([]);
  const [loadingShareUsers, setLoadingShareUsers] = useState(false);
  const [sharedSent, setSharedSent] = useState<string | null>(null);

  const openShareModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareModalOpen(true);
    setLoadingShareUsers(true);
    api.get('/api/social/users?limit=30')
      .then((res: any) => {
        if (Array.isArray(res)) {
          setShareUsers(res.filter((u: any) => u.id !== user?.id));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingShareUsers(false));
  };

  const handleShareToUser = async (targetUser: any) => {
    try {
      await api.post('/api/chat/conversations', { recipient_id: targetUser.id });
      setSharedSent(targetUser.username);
      setTimeout(() => setSharedSent(null), 3000);
    } catch (err) {
      console.error('Failed to reshare post:', err);
    }
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSaved = !isBookmarked;
    setIsBookmarked(nextSaved);
    try {
      const stored = localStorage.getItem('fxzone_saved_posts') || '[]';
      let list = JSON.parse(stored);
      if (nextSaved) {
        if (!list.includes(post.id)) list.push(post.id);
      } else {
        list = list.filter((id: string) => id !== post.id);
      }
      localStorage.setItem('fxzone_saved_posts', JSON.stringify(list));
      api.post(`/api/social/posts/${post.id}/bookmark`, {}).catch(() => {});
    } catch (err) {
      console.error(err);
    }
  };

  const timeAgo = () => {
    try {
      if (!createdAt) return 'recently';
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'analyst':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'verified_educator':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700/50';
    }
  };

  return (
    <Card 
      onClick={() => onSelect?.(post)}
      className="p-4 border border-zinc-850 bg-zinc-900/20 hover:border-zinc-800 transition-all duration-200 cursor-pointer"
    >
      <div className="flex gap-3">
        {/* User Avatar */}
        <div className="shrink-0">
          <Avatar 
            src={postUser.avatarUrl} 
            alt={postUser.displayName || postUser.username} 
            size="md"
          />
        </div>

        {/* Post Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1.5 select-none">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                {postUser.displayName || postUser.username}
              </span>
              <span className="text-[10px] text-zinc-500 truncate max-w-[80px]">
                @{postUser.username}
              </span>
              
              {postUser.role && postUser.role !== 'trader' && (
                <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider', getRoleBadgeColor(postUser.role))}>
                  {postUser.role.replace('_', ' ')}
                </span>
              )}
              {postUser.role === 'verified_educator' && (
                <CheckCircle2 size={10} className="text-blue-500 fill-blue-500/20" />
              )}
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {isStory && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                  <Clock size={9} />
                  Story
                  {expiresAt && (
                    <span className="text-purple-500/70 ml-0.5">
                      · {(() => { try { return formatDistanceToNow(new Date(expiresAt), { addSuffix: false }); } catch { return ''; } })()}
                    </span>
                  )}
                </span>
              )}
              {isBot && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                  <Zap size={9} className="fill-cyan-400" /> FxZone Bot
                </span>
              )}
              {pinned && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  <Pin size={10} className="fill-amber-400" /> Pinned
                </span>
              )}
              <span className="text-[10px] text-zinc-500">{timeAgo()}</span>
              {isOwner && (
                <button
                  onClick={handlePin}
                  title={pinned ? "Unpin post" : "Pin post"}
                  className={cn(
                    "p-1 rounded transition-colors",
                    pinned ? "text-amber-400 bg-amber-500/10" : "text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"
                  )}
                >
                  <Pin size={13} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete post"
                  className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 size={13} className={cn(deleting && "animate-spin")} />
                </button>
              )}
            </div>
          </div>

          {/* Text content - with auto-linked URLs */}
          <div className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap mb-3 break-words">
            {post.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
              if (/^https?:\/\//.test(part)) {
                return (
                  <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all"
                  >
                    {part}
                  </a>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </div>

          {/* Inline image from URL in content */}
          {!imageUrl && (() => {
            const urlMatch = post.content.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg)|https:\/\/images\.unsplash\.com\/[^\s]+)/i);
            if (urlMatch) {
              return (
                <div className="relative rounded-xl border border-zinc-800/60 overflow-hidden mb-3 bg-zinc-900/60 max-h-96 flex items-center justify-center">
                  <img
                    src={urlMatch[1]}
                    alt="Shared post attachment"
                    className="w-full max-h-96 object-cover rounded-xl hover:opacity-95 transition-opacity"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  />
                </div>
              );
            }
            return null;
          })()}

          {/* Uploaded image attachment */}
          {imageUrl && (
            <div className="relative rounded-xl border border-zinc-800/60 overflow-hidden mb-3 bg-zinc-900/60 max-h-96 flex items-center justify-center">
              <img 
                src={imageUrl} 
                alt="Post attachment" 
                className="w-full max-h-96 object-cover rounded-xl hover:opacity-95 transition-opacity"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
              />
            </div>
          )}

          {/* Asset Tags */}
          {assetTags && assetTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {assetTags.map((tag: string) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(tag);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 text-[9px] text-zinc-400 border border-zinc-850 hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  <Tag size={8} className="text-purple-400" />
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between border-t border-zinc-850/50 pt-2.5 mt-2 max-w-sm select-none">
            {/* Comment Button */}
            <button 
              className="group flex items-center gap-1.5 text-zinc-500 hover:text-blue-400 transition-colors focus:outline-none"
            >
              <MessageSquare size={13} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-medium">{post.commentsCount}</span>
            </button>

            {/* Repost Button */}
            <button 
              onClick={handleRepost}
              className={cn(
                'group flex items-center gap-1.5 transition-colors focus:outline-none',
                isReposted ? 'text-emerald-400' : 'text-zinc-500 hover:text-emerald-400'
              )}
            >
              <Repeat2 size={13} className={cn('group-hover:rotate-180 transition-transform duration-300', isReposted && 'scale-110')} />
              <span className="text-[10px] font-medium">{reposts}</span>
            </button>

            {/* Like Button */}
            <button 
              onClick={handleLike}
              className={cn(
                'group flex items-center gap-1.5 transition-colors focus:outline-none',
                isLiked ? 'text-rose-500' : 'text-zinc-500 hover:text-rose-500'
              )}
            >
              <motion.div whileTap={{ scale: 1.4 }}>
                <Heart 
                  size={13} 
                  className={cn(
                    'transition-transform',
                    isLiked ? 'fill-rose-500 stroke-rose-500' : 'group-hover:scale-110'
                  )}
                />
              </motion.div>
              <span className="text-[10px] font-medium">{likes}</span>
            </button>

            {/* Bookmark */}
            <button 
              onClick={handleBookmark}
              className={cn(
                'group flex items-center transition-colors focus:outline-none',
                isBookmarked ? 'text-yellow-500' : 'text-zinc-500 hover:text-yellow-500'
              )}
            >
              <Bookmark 
                size={13} 
                className={cn(
                  'transition-transform',
                  isBookmarked ? 'fill-yellow-500 stroke-yellow-500' : 'group-hover:scale-110'
                )}
              />
            </button>
            {/* Share / Reshare to User Button */}
            <button
              onClick={openShareModal}
              className="group flex items-center gap-1.5 text-zinc-500 hover:text-blue-400 transition-colors focus:outline-none"
              title="Reshare post to another user"
            >
              <Share2 size={13} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Reshare Post Modal */}
      {shareModalOpen && (
        <Modal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          title="Reshare Post"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850 text-xs text-zinc-300">
              <span className="text-zinc-500 font-bold block mb-1">@{postUser.username}:</span>
              <p className="line-clamp-3 italic">"{post.content}"</p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={(e) => {
                  handleRepost(e);
                  setShareModalOpen(false);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-xs flex items-center justify-center gap-2"
              >
                <Repeat2 size={14} /> Repost to My Social Feed
              </Button>
            </div>

            <div className="border-t border-zinc-850 pt-3">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Reshare Directly to a Trader
              </p>
              {loadingShareUsers ? (
                <div className="py-6 text-center text-xs text-zinc-500">Loading traders...</div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {shareUsers.map((u: any) => (
                    <div
                      key={u.id}
                      className="p-2 rounded bg-zinc-900/60 border border-zinc-850 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar src={u.avatar_url} name={u.display_name || u.username} size="sm" />
                        <div>
                          <span className="text-xs font-bold text-white block leading-none">
                            {u.display_name || u.username}
                          </span>
                          <span className="text-[9px] text-zinc-500">@{u.username}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleShareToUser(u)}
                        variant="ghost"
                        className="h-6 text-[10px] px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold"
                      >
                        {sharedSent === u.username ? 'Sent!' : 'Send Chat'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
