'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { normalizeDiscoverQuery, shouldSearchDiscover } from '@/lib/discoverSearch';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import {
  Search,
  UserPlus,
  UserMinus,
  MessageCircle,
  Loader2,
  Shield,
  TrendingUp,
  Newspaper,
  ExternalLink,
  FileText,
  PlayCircle,
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

interface DiscoverNewsArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string | null;
  published_at: string | null;
  asset_tags: string[];
  media_url: string | null;
  media_type: 'image' | 'video' | null;
}

interface NewsExplanationResult {
  source: 'ai_gateway' | 'verified_data';
  isAiGenerated: boolean;
  explanation: string;
  limitation: string;
}

interface NewsExplanationState {
  loading: boolean;
  error: string | null;
  result: NewsExplanationResult | null;
}

export default function DiscoverPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [news, setNews] = useState<DiscoverNewsArticle[]>([]);
  const [trendingNews, setTrendingNews] = useState<DiscoverNewsArticle[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [newsExplanations, setNewsExplanations] = useState<Record<string, NewsExplanationState>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  const loadSuggestedUsers = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await api.get('/api/social/users?limit=12');
      if (requestId !== requestSequence.current) return;
      setUsers(Array.isArray(result)
        ? result.filter((candidate: DiscoverUser) => candidate.id !== user?.id)
        : []);
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      console.error('Failed to load Discover traders:', error);
      setUsers([]);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadSuggestedUsers();
  }, [loadSuggestedUsers]);

  useEffect(() => {
    let active = true;
    setTrendingLoading(true);
    void api.get('/api/news/feed?limit=8', { public: true })
      .then((result) => {
        if (!active) return;
        setTrendingNews(Array.isArray(result) ? result : []);
        setTrendingError(null);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Failed to load trending market news:', error);
        setTrendingNews([]);
        setTrendingError('Trending market news is temporarily unavailable.');
      })
      .finally(() => {
        if (active) setTrendingLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchDiscovery = useCallback(async (rawQuery: string) => {
    const query = normalizeDiscoverQuery(rawQuery);
    if (!shouldSearchDiscover(query)) {
      requestSequence.current += 1;
      setUsers([]);
      setNews([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const [usersResult, newsResult] = await Promise.allSettled([
        api.get(`/api/social/users?${new URLSearchParams({ q: query, limit: '40' }).toString()}`),
        api.get(`/api/news/feed?${new URLSearchParams({ q: query, limit: '8' }).toString()}`, { public: true }),
      ]);
      if (requestId !== requestSequence.current) return;
      setUsers(usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)
        ? usersResult.value.filter((candidate: DiscoverUser) => candidate.id !== user?.id)
        : []);
      setNews(newsResult.status === 'fulfilled' && Array.isArray(newsResult.value)
        ? newsResult.value
        : []);
    } catch (err) {
      console.error('Failed to search Discover:', err);
      if (requestId === requestSequence.current) {
        setUsers([]);
        setNews([]);
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [user?.id]);

  // Default suggestions remain visible until a useful search is entered.
  // Sequence IDs prevent a late response from replacing newer results.
  useEffect(() => {
    const query = normalizeDiscoverQuery(search);
    if (!shouldSearchDiscover(query)) return;
    const timer = setTimeout(() => {
      void fetchDiscovery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchDiscovery]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    const query = normalizeDiscoverQuery(value);
    if (!shouldSearchDiscover(query)) {
      requestSequence.current += 1;
      setNews([]);
      setLoading(false);
      if (!query) void loadSuggestedUsers();
    }
  };

  const handleFollow = async (targetUser: DiscoverUser) => {
    setFollowLoading(targetUser.id);
    try {
      const result = await api.post(`/api/social/users/${targetUser.id}/follow`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? {
                ...u,
                is_following: result.is_following,
                followers_count: result.followers_count,
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
        router.push(`/chat?conv=${response.id}`);
      }
    } catch (err) {
      console.error('Failed to start DM:', err);
      // Navigate to chat page anyway
      router.push('/chat');
    }
  };

  const explainNews = async (article: DiscoverNewsArticle) => {
    setNewsExplanations((previous) => ({
      ...previous,
      [article.id]: { loading: true, error: null, result: previous[article.id]?.result ?? null },
    }));
    try {
      const result = await api.post('/api/news/explanation', article, { timeoutMs: 12_000 });
      setNewsExplanations((previous) => ({
        ...previous,
        [article.id]: { loading: false, error: null, result },
      }));
    } catch (error) {
      console.error('Failed to explain market news:', error);
      setNewsExplanations((previous) => ({
        ...previous,
        [article.id]: {
          loading: false,
          error: error instanceof Error ? error.message : 'Explanation is temporarily unavailable.',
          result: previous[article.id]?.result ?? null,
        },
      }));
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
            <Shield size={8} /> Admin
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

  // Add Trader state
  const [addTraderModalOpen, setAddTraderModalOpen] = useState(false);
  const [newTraderUsername, setNewTraderUsername] = useState('');
  const [newTraderDisplayName, setNewTraderDisplayName] = useState('');
  const [newTraderRole, setNewTraderRole] = useState('trader');
  const [newTraderBio, setNewTraderBio] = useState('');
  const [newTraderAvatar, setNewTraderAvatar] = useState('');
  const [addingTrader, setAddingTrader] = useState(false);
  const [addError, setAddError] = useState('');

  const handleAddTrader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTraderUsername.trim() || addingTrader) return;
    setAddingTrader(true);
    setAddError('');

    try {
      await api.post('/api/social/users', {
        username: newTraderUsername.trim(),
        display_name: newTraderDisplayName.trim() || newTraderUsername.trim(),
        role: newTraderRole,
        bio: newTraderBio.trim() || undefined,
        avatar_url: newTraderAvatar.trim() || undefined,
      });

      setAddTraderModalOpen(false);
      setNewTraderUsername('');
      setNewTraderDisplayName('');
      setNewTraderRole('trader');
      setNewTraderBio('');
      setNewTraderAvatar('');
      await fetchDiscovery(search);
    } catch (err: any) {
      console.error('Failed to add trader:', err);
      setAddError(err?.detail || err?.message || 'Failed to add trader to network.');
    } finally {
      setAddingTrader(false);
    }
  };

  const normalizedSearch = normalizeDiscoverQuery(search);
  const hasSearch = shouldSearchDiscover(normalizedSearch);
  const visibleNews = hasSearch ? news : trendingNews;
  const newsLoading = hasSearch ? loading : trendingLoading;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-3 sm:space-y-6 sm:p-6">
      <h1 className="text-base font-bold tracking-tight text-[var(--color-text)] sm:text-lg">Discover</h1>
      {/* Search bar */}
      <div className="relative mx-auto w-full max-w-2xl">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search a username or market news topic..."
          aria-label="Search traders and market news"
          className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-3 text-[11px] text-[var(--color-text)] transition-colors placeholder:text-[var(--color-text-muted)] focus:border-blue-500 focus:outline-none sm:text-xs"
        />
      </div>

      {/* User grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center">
          <p className="text-xs text-[var(--color-text-muted)]">
            {hasSearch ? `No traders found matching “${normalizedSearch}”.` : 'No traders are available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <Card
              key={u.id}
              className="group border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-blue-500/40"
            >
              <div
                className="flex cursor-pointer items-start gap-2.5 transition-opacity hover:opacity-90"
                onClick={() => {
                  if (u.username !== 'fxzone_bot') {
                    router.push(`/profile/${u.id || u.username}`);
                  }
                }}
                title={`View @${u.username}'s profile`}
              >
                <Avatar
                  src={u.avatar_url || undefined}
                  name={u.display_name || u.username}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="truncate text-[11px] font-bold text-[var(--color-text)] transition-colors hover:text-blue-500">
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
                    <p className="mt-1 line-clamp-1 text-[9px] leading-relaxed text-[var(--color-text-muted)]">
                      {u.bio}
                    </p>
                  )}
                  {u.username !== 'fxzone_bot' && u.role !== 'bot' && (
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[9px] text-zinc-500">
                        <strong className="text-zinc-300">{u.followers_count}</strong> followers
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {u.username !== 'fxzone_bot' && u.role !== 'bot' && (
                <div className="mt-2.5 flex gap-2 border-t border-[var(--color-border)] pt-2.5">
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
                  className="h-7 px-2 text-[10px] border border-zinc-800 hover:bg-zinc-800/50 text-zinc-300 hover:text-white hover:border-zinc-700"
                  title="Send Direct Message"
                >
                  <MessageCircle size={12} className="text-blue-400" />
                </Button>
              </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <section className="space-y-3" aria-labelledby="discover-news-heading">
        <div className="flex items-center gap-2">
          <Newspaper size={15} className="text-blue-500" aria-hidden="true" />
          <h2 id="discover-news-heading" className="text-xs font-bold text-[var(--color-text)] sm:text-sm">
            {hasSearch ? 'Market news results' : 'Latest market news'}
          </h2>
        </div>
        {newsLoading ? (
          <div className="flex items-center justify-center py-10" aria-label="Loading market news">
            <Loader2 className="animate-spin text-blue-500" size={20} />
          </div>
        ) : visibleNews.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-[11px] text-[var(--color-text-muted)] sm:text-xs">
            {hasSearch
              ? `No verified news matched “${normalizedSearch}”.`
              : trendingError ?? 'No verified trending news is available right now.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleNews.map((article) => {
              const explanation = newsExplanations[article.id];
              return (
                <article key={article.id} className="min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  {article.media_url && (
                    <a
                      href={article.url ?? article.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block aspect-video overflow-hidden bg-[var(--color-background)]"
                      aria-label={`${article.media_type === 'video' ? 'Open video report' : 'Open article'}: ${article.title}`}
                    >
                      {/* Provider URLs vary by article, so this deliberately avoids a broad Next Image allowlist. */}
                      <img
                        src={article.media_url}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      {article.media_type === 'video' && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white" aria-hidden="true">
                          <PlayCircle size={34} className="drop-shadow-lg" />
                        </span>
                      )}
                    </a>
                  )}
                  <div className="p-3 sm:p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                    <span className="font-semibold text-blue-500">{article.source}</span>
                    {article.published_at && <time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString()}</time>}
                  </div>
                  <h3 className="text-xs font-semibold leading-relaxed text-[var(--color-text)]">{article.title}</h3>
                  {article.content && (
                    <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-[var(--color-text-muted)]">{article.content}</p>
                  )}
                  {article.asset_tags?.length > 0 && (
                    <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">{article.asset_tags.slice(0, 4).join(' · ')}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void explainNews(article)}
                      disabled={explanation?.loading}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 text-[10px] font-semibold text-[var(--color-text)] transition-colors hover:border-blue-500 disabled:cursor-wait disabled:opacity-60"
                    >
                      {explanation?.loading ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                      {explanation?.result ? 'Refresh explanation' : 'Explain news'}
                    </button>
                    {article.url && (
                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 px-1 text-[10px] font-semibold text-blue-500 hover:text-blue-400">
                        Read source <ExternalLink size={10} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  {explanation?.error && (
                    <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-[10px] text-rose-400">{explanation.error}</p>
                  )}
                  {explanation?.result && (
                    <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">
                        {explanation.result.isAiGenerated ? 'AI explanation' : 'Verified context'}
                      </p>
                      <p className="mt-1.5 text-[11px] leading-5 text-[var(--color-text)]">{explanation.result.explanation}</p>
                      <p className="mt-2 text-[9px] leading-4 text-[var(--color-text-muted)]">{explanation.result.limitation}</p>
                    </div>
                  )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Add Trader Modal */}
      {addTraderModalOpen && (
        <Modal
          isOpen={addTraderModalOpen}
          onClose={() => setAddTraderModalOpen(false)}
          title="Add Trader to Network Directory"
        >
          <form onSubmit={handleAddTrader} className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                Username <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newTraderUsername}
                onChange={(e) => setNewTraderUsername(e.target.value)}
                placeholder="e.g. SatoshiFx or TraderJoe"
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                Display Name
              </label>
              <input
                type="text"
                value={newTraderDisplayName}
                onChange={(e) => setNewTraderDisplayName(e.target.value)}
                placeholder="e.g. Satoshi Nakamoto"
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                Role / Expertise
              </label>
              <select
                value={newTraderRole}
                onChange={(e) => setNewTraderRole(e.target.value)}
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white focus:outline-none focus:border-zinc-700"
              >
                <option value="trader">Trader</option>
                <option value="analyst">Analyst</option>
                <option value="verified_educator">Verified Educator</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                Bio / Strategy
              </label>
              <textarea
                value={newTraderBio}
                onChange={(e) => setNewTraderBio(e.target.value)}
                placeholder="Trading methodology, preferred asset pairs, risk strategies..."
                className="w-full h-20 bg-zinc-950 border border-zinc-850 rounded-lg p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                Avatar Image URL (Optional)
              </label>
              <input
                type="url"
                value={newTraderAvatar}
                onChange={(e) => setNewTraderAvatar(e.target.value)}
                placeholder="https://..."
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>

            {addError && (
              <p className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded">
                {addError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAddTraderModalOpen(false)}
                disabled={addingTrader}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 font-bold text-xs"
                type="submit"
                disabled={!newTraderUsername.trim() || addingTrader}
              >
                {addingTrader ? (
                  <>
                    <Loader2 size={12} className="animate-spin mr-1" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus size={12} className="mr-1" />
                    Add Trader to Discover
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
