'use client';

import React, { useState, useEffect } from 'react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, MessageSquare, Send, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  user: {
    id?: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  content: string;
  parentId?: string | null;
  createdAt: string;
}

interface CommentThreadProps {
  postId: string;
  initialComments?: Comment[];
}

export function CommentThread({ postId, initialComments = [] }: CommentThreadProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [loading, setLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/social/posts/${postId}/comments`);
      if (Array.isArray(response)) {
        setComments(response);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.delete(`/api/social/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Could not delete comment.');
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);

    try {
      const response = await api.post(`/api/social/posts/${postId}/comments`, {
        content: commentInput.trim(),
      });
      if (response) {
        setComments((prev) => [response, ...prev]);
        setCommentInput('');
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCommentTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  const isAdmin = user?.email === 'mthobisimzimela031@gmail.com' || user?.username === 'admin' || user?.role === 'admin';

  return (
    <div className="space-y-4 pt-4 border-t border-zinc-850">
      <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold select-none">
        <MessageSquare size={13} />
        <span>Discussion ({comments.length})</span>
      </div>

      {/* Write Comment Form */}
      <form onSubmit={handleSubmitComment} className="flex gap-2">
        <Input
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          placeholder="Write a reply..."
          className="h-8 py-1 px-3 bg-zinc-950 text-xs border-zinc-850"
          disabled={submitting}
        />
        <Button
          type="submit"
          size="sm"
          className="h-8 px-3 bg-blue-600 hover:bg-blue-500 shrink-0"
          disabled={!commentInput.trim() || submitting}
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </Button>
      </form>

      {/* Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin text-blue-500" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-[10px] text-zinc-500 italic py-2">No replies yet. Be the first to join the conversation.</p>
        ) : (
          comments.map((comment) => {
            const raw = comment as any;
            const cUserId = comment.userId || raw.user_id;
            const isCommentOwner = String(user?.id) === String(cUserId) || String(user?.id) === String(comment.user?.id);
            const canDeleteComment = isCommentOwner || isAdmin;

            return (
              <div key={comment.id} className="flex gap-2.5 items-start p-2 bg-zinc-900/10 border border-zinc-850/30 rounded-lg group">
                <Avatar src={comment.user?.avatarUrl || raw.user?.avatar_url} alt={comment.user?.username} size="sm" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-2 mb-0.5 select-none">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-white">
                        {comment.user?.displayName || raw.user?.display_name || comment.user?.username}
                      </span>
                      <span className="text-[9px] text-zinc-500">@{comment.user?.username || raw.user?.username}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] text-zinc-500">{formatCommentTime(comment.createdAt || raw.created_at)}</span>
                      {canDeleteComment && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          title="Delete comment"
                          className="p-0.5 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
