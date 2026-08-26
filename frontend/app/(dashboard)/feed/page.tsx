'use client';

import React, { useState, useEffect } from 'react';
import { StoryBar } from '@/components/social/StoryBar';
import { PostComposer } from '@/components/social/PostComposer';
import { PostCard, Post } from '@/components/social/PostCard';
import { CommentThread } from '@/components/social/CommentThread';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { TrendingUp, RefreshCw, Loader2, Sparkles, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function SocialFeedPage() {
  const { user } = useAuth();
  const isAdmin =
    user?.email === 'mthobisimzimela031@gmail.com' ||
    user?.username === 'admin' ||
    user?.role === 'admin' ||
    (user?.role as any)?.value === 'admin';
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Sidebar dynamic real data
  const [trendingSymbols, setTrendingSymbols] = useState<any[]>([]);
  const [featuredExperts, setFeaturedExperts] = useState<any[]>([]);

  const fetchSidebarData = async () => {
    try {
      const [trendRes, expertRes, quotesRes] = await Promise.allSettled([
        api.get('/api/social/trending-symbols'),
        api.get('/api/social/featured-experts'),
        api.get('/api/market/quotes'),
      ]);

      const quotesMap = new Map<string, any>();
      if (quotesRes.status === 'fulfilled' && Array.isArray(quotesRes.value)) {
        quotesRes.value.forEach((q: any) => quotesMap.set(q.symbol, q));
      }

      if (trendRes.status === 'fulfilled' && Array.isArray(trendRes.value)) {
        setTrendingSymbols(
          trendRes.value.map((t: any) => {
            const q = quotesMap.get(t.symbol);
            const changePercent = q?.change_percent ?? q?.changePercent;
            return {
              symbol: t.symbol,
              posts: t.posts ?? 0,
              change: changePercent !== undefined ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '0.00%',
              price: q?.price ?? null,
            };
          })
        );
      } else {
        // Default standard active pairs if none
        setTrendingSymbols([
          { symbol: 'BTCUSD', posts: 0, change: '+0.00%' },
          { symbol: 'EURUSD', posts: 0, change: '+0.00%' },
          { symbol: 'AAPL', posts: 0, change: '+0.00%' },
          { symbol: 'SOLUSD', posts: 0, change: '+0.00%' },
        ]);
      }

      if (expertRes.status === 'fulfilled' && Array.isArray(expertRes.value)) {
        setFeaturedExperts(expertRes.value);
      }
    } catch (e) {
      console.error('Failed to load sidebar data:', e);
    }
  };

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/social/feed');
      if (Array.isArray(response)) {
        const mapped = response.map((p: any) => ({
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
          isBookmarkedByUser:
            p.is_bookmarked_by_user ?? p.isBookmarkedByUser ?? false,
          isPinned: p.is_pinned ?? p.isPinned ?? false,
          createdAt: p.created_at || p.createdAt || new Date().toISOString(),
          repostedBy: p.reposted_by || p.repostedBy || null,
          caption: p.caption || null,
        }));

        // Deduplicate posts strictly by ID to prevent any duplicate UI render
        const uniquePostsMap = new Map<string, Post>();
        for (const post of mapped) {
          if (post.id && !uniquePostsMap.has(post.id)) {
            uniquePostsMap.set(post.id, post);
          }
        }
        setPosts(Array.from(uniquePostsMap.values()));
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    fetchSidebarData();
    const handleRefresh = () => {
      fetchFeed();
      fetchSidebarData();
    };
    window.addEventListener('fxzone_refresh_feed', handleRefresh);
    return () => window.removeEventListener('fxzone_refresh_feed', handleRefresh);
  }, []);

  const handleStartFresh = async () => {
    if (!confirm('Are you sure you want to delete all feed posts and start fresh?'))
      return;
    try {
      await api.delete('/api/social/posts/purge-all');
      setPosts([]);
      window.dispatchEvent(new CustomEvent('fxzone_refresh_feed'));
      window.dispatchEvent(new CustomEvent('fxzone_refresh_saved_posts'));
    } catch (err) {
      console.error(err);
      setPosts([]);
    }
  };

  const handlePostDeleted = (deletedId: string) => {
    // Instant optimistic update and cache strip
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  return (
    <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 select-none max-w-7xl mx-auto">
      {/* Left 3 Columns: StoryBar, PostComposer, Feed List */}
      <div className="lg:col-span-3 space-y-4">
        {/* Stories */}
        <StoryBar />

        {/* Composer */}
        <PostComposer onPostCreated={() => {
          fetchFeed();
          fetchSidebarData();
        }} />

        {/* Refresh Feed & Start Fresh Action */}
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Operator Streams
          </span>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleStartFresh}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 rounded transition-colors"
                title="Delete all social feed posts and start fresh"
              >
                Start Fresh (Purge Feed)
              </button>
            )}
            <button
              onClick={() => {
                fetchFeed();
                fetchSidebarData();
              }}
              disabled={loading}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 transition-colors"
              title="Refresh social feed"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Feed List */}
        <div className="space-y-4">
          {loading && posts.length === 0 ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20">
              <p className="text-xs text-zinc-400 font-semibold">No posts on the feed yet.</p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Be the first to share market charts, ideas, or analysis!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onSelect={setSelectedPost}
                onDelete={handlePostDeleted}
              />
            ))
          )}
        </div>
      </div>

      {/* Right 1 Column: Sticky Trending Sidebar */}
      <div className="lg:col-span-1 space-y-4 hidden lg:block sticky top-0 h-fit">
        {/* Trending Symbols Widget */}
        <Card className="p-4 border border-zinc-900 bg-zinc-950/40">
          <h4 className="text-xs font-bold text-white mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-400" /> Trending Symbols
          </h4>
          <div className="space-y-3">
            {trendingSymbols.length === 0 ? (
              <p className="text-[10px] text-zinc-500 italic">Loading market symbols...</p>
            ) : (
              trendingSymbols.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {item.symbol}
                    </span>
                    <span className="text-[8px] text-zinc-500">
                      {item.posts > 0 ? `${item.posts} discussions` : 'Market Active'}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      item.change?.startsWith('+')
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}
                  >
                    {item.change}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Featured Analysts */}
        <Card className="p-4 border border-zinc-900 bg-zinc-950/40">
          <h4 className="text-xs font-bold text-white mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} className="text-purple-400" /> Featured Experts
          </h4>
          <div className="space-y-3">
            {featuredExperts.length === 0 ? (
              <p className="text-[10px] text-zinc-500 italic">No registered experts yet.</p>
            ) : (
              featuredExperts.map((expert, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={expert.name} src={expert.avatar_url} size="sm" />
                    <div>
                      <span className="text-[10px] font-bold text-white block truncate max-w-[100px]">
                        {expert.name}
                      </span>
                      <span className="text-[8px] text-zinc-500 block truncate max-w-[100px]">
                        @{expert.handle}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-semibold">
                    {expert.followers} {expert.followers === 1 ? 'follower' : 'followers'}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Post Modal Details & Discussion */}
      {selectedPost && (
        <Modal
          isOpen={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          title="Operator Post Details"
        >
          <div className="space-y-4">
            <PostCard post={selectedPost} onDelete={() => {
              handlePostDeleted(selectedPost.id);
              setSelectedPost(null);
            }} />
            <CommentThread postId={selectedPost.id} />
          </div>
        </Modal>
      )}
    </div>
  );
}
