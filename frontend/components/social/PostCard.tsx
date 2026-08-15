'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import {
  Heart,
  MessageSquare,
  Repeat2,
  Bookmark,
  Share2,
  Tag,
  CheckCircle2,
  Trash2,
  Pin,
  Clock,
  Zap,
  Copy,
  Check,
  Send,
  Loader2,
  Mic,
  Film,
  Play,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CommentThread } from './CommentThread';
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
  showCommentsCount?: boolean;
  showLikesCount?: boolean;
  allowReshare?: boolean;
  allowSave?: boolean;
  allowShare?: boolean;
  show_comments_count?: boolean;
  show_likes_count?: boolean;
  allow_reshare?: boolean;
  allow_save?: boolean;
  allow_share?: boolean;
  isLikedByUser?: boolean;
  isRepostedByUser?: boolean;
  isBookmarkedByUser?: boolean;
  isPinned?: boolean;
  isStory?: boolean;
  expiresAt?: string;
  createdAt: string;
  repostedBy?: {
    id: string;
    username: string;
    display_name?: string;
  } | null;
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
    displayName:
      post.user?.displayName ||
      raw.user?.display_name ||
      raw.user?.displayName ||
      post.user?.username ||
      raw.user?.username ||
      'Trader',
    avatarUrl: post.user?.avatarUrl || raw.user?.avatar_url || raw.user?.avatarUrl,
    role: post.user?.role || raw.user?.role || 'trader',
  };

  const imageUrl = post.imageUrl || raw.image_url;
  const assetTags = post.assetTags || raw.asset_tags || [];
  const initialLikes = post.likesCount ?? raw.likes_count ?? 0;
  const initialComments = post.commentsCount ?? raw.comments_count ?? 0;
  const initialReposts = post.repostsCount ?? raw.reposts_count ?? 0;
  const initialLiked = post.isLikedByUser ?? raw.is_liked_by_user ?? false;
  const initialReposted = post.isRepostedByUser ?? raw.is_reposted_by_user ?? false;
  const initialBookmarked = post.isBookmarkedByUser ?? raw.is_bookmarked_by_user ?? false;
  const createdAt = post.createdAt || raw.created_at;

  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(!!initialLiked);
  const [commentsCount, setCommentsCount] = useState(initialComments);
  const [showComments, setShowComments] = useState(false);
  const [reposts, setReposts] = useState(initialReposts);
  const [isReposted, setIsReposted] = useState(!!initialReposted);
  const [isBookmarked, setIsBookmarked] = useState(!!initialBookmarked);
  const isPinned = post.isPinned ?? raw.is_pinned ?? false;
  const [pinned, setPinned] = useState(!!isPinned);
  const isStory = post.isStory ?? raw.is_story ?? false;
  const expiresAt = post.expiresAt || raw.expires_at;
  const isBot = postUser.username === 'fxzone_bot' || postUser.role === 'bot';

  const [deleting, setDeleting] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [repostLoading, setRepostLoading] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const isOwner = String(user?.id) === String(userId) || String(user?.id) === String(postUser.id);
  const isAdmin =
    user?.email === 'mthobisimzimela031@gmail.com' ||
    user?.username === 'admin' ||
    user?.role === 'admin' ||
    (user?.role as any)?.value === 'admin';
  const canDelete = isOwner || isAdmin;

  // Pin / Unpin Post
  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = !pinned;
    setPinned(newPinned);
    try {
      await api.post(`/api/social/posts/${post.id}/pin`, {});
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fxzone_refresh_feed'));
      }
    } catch (err) {
      console.error('Failed to pin post:', err);
      setPinned(!newPinned);
    }
  };

  // Delete Post
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

  // Like / Unlike Post
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (likeLoading) return;
    setLikeLoading(true);

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikes((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await api.post(`/api/social/posts/${post.id}/react`, { reaction_type: 'like' });
      if (res && typeof res.likes_count === 'number') {
        setLikes(res.likes_count);
        setIsLiked(res.active);
      }
    } catch (err) {
      console.error('Like toggle error:', err);
      setIsLiked(!nextLiked);
      setLikes((prev) => (!nextLiked ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setLikeLoading(false);
    }
  };

  // Repost / Reshare Post
  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (repostLoading) return;
    setRepostLoading(true);

    const nextReposted = !isReposted;
    setIsReposted(nextReposted);
    setReposts((prev) => (nextReposted ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await api.post(`/api/social/posts/${post.id}/repost`, {});
      if (res && typeof res.reposts_count === 'number') {
        setReposts(res.reposts_count);
        setIsReposted(res.is_reposted ?? nextReposted);
      }
      // Refresh the feed so reshared posts appear immediately
      window.dispatchEvent(new CustomEvent('fxzone_refresh_feed'));
    } catch (err) {
      console.error('Repost error:', err);
      setIsReposted(!nextReposted);
      setReposts((prev) => (!nextReposted ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setRepostLoading(false);
    }
  };

  // Toggle Inline Comments
  const handleToggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments((prev) => !prev);
  };

  // Bookmark / Save Post
  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmarkLoading) return;
    setBookmarkLoading(true);

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

      const res = await api.post(`/api/social/posts/${post.id}/bookmark`, {});
      if (res && typeof res.is_bookmarked === 'boolean') {
        setIsBookmarked(res.is_bookmarked);
      }
    } catch (err) {
      console.error('Bookmark error:', err);
    } finally {
      setBookmarkLoading(false);
    }
  };

  // Share Dialog & Copy Link
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState<any[]>([]);
  const [loadingShareUsers, setLoadingShareUsers] = useState(false);
  const [sharedSent, setSharedSent] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const openShareModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareModalOpen(true);
    setLoadingShareUsers(true);
    api
      .get('/api/social/users?limit=30')
      .then((res: any) => {
        if (Array.isArray(res)) {
          setShareUsers(res.filter((u: any) => u.id !== user?.id));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingShareUsers(false));
  };

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/feed#post-${post.id}`;
    navigator.clipboard.writeText(postUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleShareToUser = async (targetUser: any) => {
    try {
      const conv = await api.post('/api/chat/conversations', {
        participant_ids: [targetUser.id],
        is_group: false,
      });
      if (conv && conv.id) {
        const shareText = `[Shared Post] "${post.content.slice(0, 100)}..." (${window.location.origin}/feed#post-${post.id})`;
        await api.post(`/api/chat/conversations/${conv.id}/messages`, {
          content: shareText,
          message_type: 'text',
        });
        setSharedSent(targetUser.username);
        setTimeout(() => setSharedSent(null), 3000);
      }
    } catch (err) {
      console.error('Failed to reshare post to chat:', err);
    }
  };

  const getTimestamps = () => {
    try {
      if (!createdAt) return { rel: 'recently', exact: '' };
      const d = typeof createdAt === 'string' ? parseISO(createdAt) : new Date(createdAt);
      if (isNaN(d.getTime())) return { rel: 'recently', exact: '' };
      const rel = formatDistanceToNow(d, { addSuffix: true });
      const exact = format(d, "MMM d, yyyy 'at' h:mm a");
      return { rel, exact };
    } catch {
      return { rel: 'recently', exact: '' };
    }
  };
  const { rel: timeRel, exact: timeExact } = getTimestamps();

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

  // Media Detection Helpers
  const isVideoUrl = (url?: string) => {
    if (!url) return false;
    return /\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i.test(url);
  };

  const isAudioUrl = (url?: string) => {
    if (!url) return false;
    return /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(url) || url.includes('voice-memo');
  };

  // YouTube match in content
  const youtubeMatch = post.content.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  const youtubeId = youtubeMatch ? youtubeMatch[1] : null;

  const repostedBy = (post as any).repostedBy || (post as any).reposted_by;

  return (
    <Card
      id={`post-${post.id}`}
      onClick={() => onSelect?.(post)}
      className="p-0 border border-zinc-850 bg-zinc-900/20 hover:border-zinc-800 transition-all duration-200 cursor-pointer rounded-xl overflow-hidden"
    >
      {/* Repost Banner */}
      {repostedBy && (
        <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1 bg-emerald-500/5 border-b border-emerald-500/10">
          <Repeat2 size={11} className="text-emerald-400 shrink-0" />
          <span className="text-[10px] text-emerald-400 font-semibold truncate">
            Reshared by{' '}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/profile/${repostedBy.id || repostedBy.username}`;
              }}
              className="hover:underline font-bold"
            >
              @{repostedBy.username}
            </button>
          </span>
        </div>
      )}
      <div className="flex gap-3 p-4">
        {/* User Avatar - clickable to view profile */}
        <div
          className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            const target = postUser.id || postUser.username;
            if (target && postUser.username !== 'fxzone_bot') {
              window.location.href = `/profile/${target}`;
            }
          }}
          title={`View @${postUser.username}'s profile`}
        >
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
            <div
              className="flex items-center gap-1.5 flex-wrap cursor-pointer group/author"
              onClick={(e) => {
                e.stopPropagation();
                const target = postUser.id || postUser.username;
                if (target && postUser.username !== 'fxzone_bot') {
                  window.location.href = `/profile/${target}`;
                }
              }}
              title={`View @${postUser.username}'s profile`}
            >
              <span className="text-xs font-semibold text-white truncate max-w-[140px] group-hover/author:text-blue-400 group-hover/author:underline transition-colors">
                {postUser.displayName || postUser.username}
              </span>
              <span className="text-[10px] text-zinc-500 truncate max-w-[90px]">
                @{postUser.username}
              </span>

              {postUser.role && postUser.role !== 'trader' && (
                <span
                  className={cn(
                    'text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider',
                    getRoleBadgeColor(postUser.role)
                  )}
                >
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
                      ·{' '}
                      {(() => {
                        try {
                          return formatDistanceToNow(new Date(expiresAt), { addSuffix: false });
                        } catch {
                          return '';
                        }
                      })()}
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
              <span
                className="text-[10px] text-zinc-500 cursor-default flex flex-col items-end"
                title={timeExact || undefined}
              >
                <span>{timeRel}</span>
                {timeExact && (
                  <span className="text-[9px] text-zinc-600 leading-tight hidden sm:block">{timeExact}</span>
                )}
              </span>
              {isOwner && (
                <button
                  onClick={handlePin}
                  title={pinned ? 'Unpin post' : 'Pin post'}
                  className={cn(
                    'p-1 rounded transition-colors',
                    pinned
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'
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
                  <Trash2 size={13} className={cn(deleting && 'animate-spin')} />
                </button>
              )}
            </div>
          </div>

          {/* Text Content with Viewable Link Highlights */}
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
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all bg-blue-500/10 px-1.5 py-0.5 rounded font-mono text-[11px]"
                  >
                    <span>{part}</span>
                    <ExternalLink size={10} className="shrink-0" />
                  </a>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </div>

          {/* YouTube Video Player Embed */}
          {youtubeId && (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-3 border border-zinc-800 bg-black shadow-lg">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title="YouTube Video Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          )}

          {/* Video Attachment Player */}
          {imageUrl && isVideoUrl(imageUrl) && (
            <div className="relative rounded-xl border border-zinc-800/80 overflow-hidden mb-3 bg-black max-h-96 flex items-center justify-center shadow-lg">
              <video
                src={imageUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-96 rounded-xl object-contain bg-black"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Audio / Voice Memo Player */}
          {imageUrl && isAudioUrl(imageUrl) && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-950/90 border border-purple-500/30 rounded-xl p-3 flex items-center gap-3 mb-3 shadow-md"
            >
              <div className="h-9 w-9 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0">
                <Mic size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                  Audio / Voice Memo
                </span>
                <audio src={imageUrl} controls className="w-full h-8" />
              </div>
            </div>
          )}

          {/* Image Attachment (when not video/audio) */}
          {imageUrl && !isVideoUrl(imageUrl) && !isAudioUrl(imageUrl) && (
            <div className="relative rounded-xl border border-zinc-800/60 overflow-hidden mb-3 bg-zinc-900/60 max-h-96 flex items-center justify-center">
              <img
                src={imageUrl}
                alt="Post attachment"
                className="w-full max-h-96 object-cover rounded-xl hover:opacity-95 transition-opacity"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
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
          {(() => {
            const showCommentsCountOpt = post.showCommentsCount ?? raw.show_comments_count ?? true;
            const showLikesCountOpt = post.showLikesCount ?? raw.show_likes_count ?? true;
            const allowReshareOpt = post.allowReshare ?? raw.allow_reshare ?? true;
            const allowSaveOpt = post.allowSave ?? raw.allow_save ?? true;
            const allowShareOpt = post.allowShare ?? raw.allow_share ?? true;

            return (
              <div className="flex items-center justify-between border-t border-zinc-850/50 pt-2.5 mt-2 max-w-sm select-none">
                {!isBot && (
                  <>
                    {/* Comment Toggle Button */}
                    <button
                      onClick={handleToggleComments}
                      className={cn(
                        'group flex items-center gap-1.5 transition-colors focus:outline-none px-1.5 py-1 rounded-md',
                        showComments
                          ? 'text-blue-400 bg-blue-500/10'
                          : 'text-zinc-500 hover:text-blue-400 hover:bg-zinc-850/40'
                      )}
                      title="View and post comments"
                    >
                      <MessageSquare size={13} className="group-hover:scale-110 transition-transform" />
                      {showCommentsCountOpt && (
                        <span className="text-[10px] font-medium">{commentsCount}</span>
                      )}
                    </button>

                    {/* Repost / Reshare Button */}
                    {allowReshareOpt && (
                      <button
                        onClick={handleRepost}
                        disabled={repostLoading}
                        className={cn(
                          'group flex items-center gap-1.5 transition-colors focus:outline-none px-1.5 py-1 rounded-md',
                          isReposted
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-zinc-500 hover:text-emerald-400 hover:bg-zinc-850/40'
                        )}
                        title={isReposted ? 'Remove repost' : 'Repost to feed'}
                      >
                        <Repeat2
                          size={13}
                          className={cn(
                            'group-hover:rotate-180 transition-transform duration-300',
                            isReposted && 'scale-110'
                          )}
                        />
                        <span className="text-[10px] font-medium">{reposts}</span>
                      </button>
                    )}
                  </>
                )}

                {/* Like Button */}
                <button
                  onClick={handleLike}
                  disabled={likeLoading}
                  className={cn(
                    'group flex items-center gap-1.5 transition-colors focus:outline-none px-1.5 py-1 rounded-md',
                    isLiked
                      ? 'text-rose-500 bg-rose-500/10'
                      : 'text-zinc-500 hover:text-rose-500 hover:bg-zinc-850/40'
                  )}
                  title={isLiked ? 'Unlike post' : 'Like post'}
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
                  {showLikesCountOpt && (
                    <span className="text-[10px] font-medium">{likes}</span>
                  )}
                </button>

                {!isBot && (
                  <>
                    {/* Bookmark / Save Button */}
                    {allowSaveOpt && (
                      <button
                        onClick={handleBookmark}
                        disabled={bookmarkLoading}
                        className={cn(
                          'group flex items-center transition-colors focus:outline-none px-1.5 py-1 rounded-md',
                          isBookmarked
                            ? 'text-yellow-500 bg-yellow-500/10'
                            : 'text-zinc-500 hover:text-yellow-500 hover:bg-zinc-850/40'
                        )}
                        title={isBookmarked ? 'Remove from Saved' : 'Save / Bookmark post'}
                      >
                        <Bookmark
                          size={13}
                          className={cn(
                            'transition-transform',
                            isBookmarked
                              ? 'fill-yellow-500 stroke-yellow-500'
                              : 'group-hover:scale-110'
                          )}
                        />
                      </button>
                    )}

                    {/* Share Button */}
                    {allowShareOpt && (
                      <button
                        onClick={openShareModal}
                        className="group flex items-center gap-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-850/40 px-1.5 py-1 rounded-md transition-colors focus:outline-none"
                        title="Share post"
                      >
                        <Share2 size={13} className="group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* Inline Comment Thread */}
          <AnimatePresence>
            {showComments && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="overflow-hidden"
              >
                <CommentThread
                  postId={post.id}
                  onCommentAdded={() => setCommentsCount((prev) => prev + 1)}
                  onCommentDeleted={() => setCommentsCount((prev) => Math.max(0, prev - 1))}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Share / Reshare Post Modal */}
      {shareModalOpen && (
        <Modal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          title="Share Post"
        >
          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850 text-xs text-zinc-300">
              <span className="text-zinc-500 font-bold block mb-1">@{postUser.username}:</span>
              <p className="line-clamp-3 italic">&quot;{post.content}&quot;</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="w-full text-xs flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-850 border-zinc-850"
              >
                {copiedLink ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Link</span>
                  </>
                )}
              </Button>

              <Button
                onClick={(e) => {
                  handleRepost(e);
                  setShareModalOpen(false);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-xs flex items-center justify-center gap-1.5 font-bold"
              >
                <Repeat2 size={14} />
                <span>{isReposted ? 'Remove Repost' : 'Repost to Feed'}</span>
              </Button>
            </div>

            <div className="border-t border-zinc-850 pt-3">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Send Direct Message to Trader
              </p>
              {loadingShareUsers ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  <Loader2 size={16} className="animate-spin mx-auto text-blue-500 mb-1" />
                  Loading traders...
                </div>
              ) : shareUsers.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-center py-4">
                  No other traders available.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {shareUsers.map((u: any) => (
                    <div
                      key={u.id}
                      className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-850 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          src={u.avatar_url}
                          name={u.display_name || u.username}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate leading-none">
                            {u.display_name || u.username}
                          </span>
                          <span className="text-[9px] text-zinc-500 block truncate">
                            @{u.username}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleShareToUser(u)}
                        variant="ghost"
                        className="h-6 text-[10px] px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold shrink-0"
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
