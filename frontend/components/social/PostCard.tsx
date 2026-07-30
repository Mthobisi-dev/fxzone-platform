'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Heart, MessageSquare, Repeat2, Bookmark, Share2, Tag, CheckCircle2, Trash2, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
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

  const [deleting, setDeleting] = useState(false);
  const isOwner = String(user?.id) === String(userId) || String(user?.id) === String(postUser.id);
  const isAdmin = user?.email === 'mthobisimzimela031@gmail.com' || user?.username === 'admin' || user?.role === 'admin' || (user?.role as any)?.value === 'admin';
  const canDelete = isOwner || isAdmin;

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

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
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
          </div>
        </div>
      </div>
    </Card>
  );
}
