'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { CheckCircle2, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface UserProfileSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
}

interface UserCardProps {
  userSummary: UserProfileSummary;
  onProfileClick?: (userId: string) => void;
}

export function UserCard({ userSummary, onProfileClick }: UserCardProps) {
  const [isFollowing, setIsFollowing] = useState(!!userSummary.isFollowing);
  const [followers, setFollowers] = useState(userSummary.followersCount);
  const [loading, setLoading] = useState(false);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const originalFollowing = isFollowing;
    const newFollowing = !isFollowing;
    
    // Optimistic update
    setIsFollowing(newFollowing);
    setFollowers((prev) => (newFollowing ? prev + 1 : prev - 1));

    try {
      await api.post(`/api/social/users/${userSummary.id}/follow`, {});
    } catch (err) {
      console.error('Follow error:', err);
      // Revert on error
      setIsFollowing(originalFollowing);
      setFollowers((prev) => (originalFollowing ? prev + 1 : prev - 1));
    } finally {
      setLoading(false);
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
      onClick={() => onProfileClick?.(userSummary.id)}
      className="p-4 border border-zinc-850 bg-zinc-900/25 hover:border-zinc-800 transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar src={userSummary.avatarUrl} alt={userSummary.username} size="md" className="shrink-0" />
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <h4 className="text-xs font-bold text-white truncate max-w-[120px]">
              {userSummary.displayName || userSummary.username}
            </h4>
            {userSummary.role === 'verified_educator' && (
              <CheckCircle2 size={10} className="text-blue-500 fill-blue-500/10" />
            )}
          </div>
          <span className="text-[10px] text-zinc-500 block mb-1">@{userSummary.username}</span>

          {userSummary.role && userSummary.role !== 'trader' && (
            <span className={cn('inline-block text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider mb-2', getRoleBadgeColor(userSummary.role))}>
              {userSummary.role.replace('_', ' ')}
            </span>
          )}

          {userSummary.bio && (
            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-3">
              {userSummary.bio}
            </p>
          )}
        </div>
      </div>

      {/* Stats and Follow Button */}
      <div className="flex items-center justify-between border-t border-zinc-850/50 pt-3 mt-2 select-none">
        <div className="flex gap-4">
          <div>
            <span className="text-[10px] font-semibold text-zinc-200 block leading-tight">{followers}</span>
            <span className="text-[8px] text-zinc-500">Followers</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-zinc-200 block leading-tight">{userSummary.followingCount}</span>
            <span className="text-[8px] text-zinc-500">Following</span>
          </div>
        </div>

        <Button
          onClick={handleFollowToggle}
          variant={isFollowing ? 'outline' : 'primary'}
          size="sm"
          className={cn(
            'h-7 px-3 text-[10px] flex items-center gap-1 shrink-0 font-semibold',
            isFollowing ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={10} className="animate-spin" />
          ) : isFollowing ? (
            <>
              <UserMinus size={10} />
              <span>Unfollow</span>
            </>
          ) : (
            <>
              <UserPlus size={10} />
              <span>Follow</span>
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
