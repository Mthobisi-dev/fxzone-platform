'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import {
  Video,
  Users,
  Plus,
  RefreshCw,
  Loader2,
  Calendar,
  Radio,
  Trash2,
  Search,
  Lock,
  Globe,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LiveSession {
  id: string;
  hostId: string;
  host: {
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  title: string;
  description: string;
  status: 'scheduled' | 'live' | 'ended';
  participantsCount: number;
  startedAt?: string;
  requiresApproval?: boolean;
}

export default function SessionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [cuttingOff, setCuttingOff] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New session modal states
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [creating, setCreating] = useState(false);

  const isAdmin = !!(
    user &&
    ((user as any).role === 'admin' ||
      (user as any).role?.value === 'admin' ||
      (user as any).username === 'admin' ||
      (user as any).username === 'fxzone_admin' ||
      (user as any).username === 'mthobisi' ||
      (user as any).email === 'admin@fxzone.io' ||
      (user as any).email === 'mthobisimzimela031@gmail.com')
  );

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/sessions');
      if (Array.isArray(response)) {
        const mapped = response.map((s: any) => ({
          id: String(s.id),
          hostId: String(s.host_id || s.hostId),
          host: {
            username: s.host?.username || '',
            displayName: s.host?.display_name || s.host?.displayName || s.host?.username || 'Host',
            avatarUrl: s.host?.avatar_url || s.host?.avatarUrl,
          },
          title: s.title,
          description: s.description || '',
          status: s.status,
          participantsCount: s.participants_count || s.participantsCount || 0,
          startedAt: s.started_at || s.startedAt,
          requiresApproval: s.requires_approval ?? s.requiresApproval ?? false,
        }));
        setSessions(mapped);
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;
    setCreating(true);

    try {
      const response = await api.post('/api/sessions', {
        title: newTitle.trim(),
        description: newDesc.trim(),
        requires_approval: requiresApproval,
      });
      if (response && response.id) {
        setNewTitle('');
        setNewDesc('');
        setCreateOpen(false);
        router.push(`/session/${response.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSession = (id: string) => {
    router.push(`/session/${id}`);
  };

  const handleClearHistory = async () => {
    if (
      !confirm(
        'Clear ALL ended session records and their participant history? This cannot be undone.'
      )
    )
      return;
    try {
      await api.delete('/api/sessions/history');
      setSessions((prev) => prev.filter((s) => s.status !== 'ended'));
    } catch (err) {
      console.error('Clear history error:', err);
      alert('Failed to clear session history.');
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Permanently delete this live session record?')) return;
    setDeletingId(id);
    // Optimistic removal from UI immediately
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await api.delete(`/api/sessions/${id}`);
    } catch (err: any) {
      console.error('Delete session error:', err);
      alert(err?.detail || 'Failed to delete session record.');
      fetchSessions();
    } finally {
      setDeletingId(null);
    }
  };

  // Admin-only: terminate a live/scheduled session
  const handleAdminCutOff = async (id: string) => {
    if (
      !confirm('Cut off this live session? All participants will be disconnected.')
    )
      return;
    setCuttingOff(id);
    try {
      await api.post(`/api/sessions/${id}/end`, {});
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'ended' } : s))
      );
    } catch (err) {
      console.error('Admin cutoff error:', err);
      alert('Failed to cut off session.');
    } finally {
      setCuttingOff(null);
    }
  };

  // Filtered sessions
  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      s.host.displayName.toLowerCase().includes(query) ||
      s.host.username.toLowerCase().includes(query)
    );
  });

  const liveSessions = filteredSessions.filter((s) => s.status === 'live');
  const scheduledSessions = filteredSessions.filter(
    (s) => s.status === 'scheduled'
  );
  const endedSessions = filteredSessions.filter((s) => s.status === 'ended');

  return (
    <div className="p-4 md:p-6 space-y-6 select-none max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none">
        <div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Radio size={18} className="text-red-500 animate-pulse" />
            Live Trading Rooms
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Stream, screen share, and analyze live order books with verified educators and traders.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search live rooms..."
              className="w-full h-8 pl-8 pr-3 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <button
            onClick={fetchSessions}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors border border-zinc-850 shrink-0"
            title="Refresh Live Sessions"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="h-8 text-xs font-bold px-3.5 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 shrink-0"
          >
            <Plus size={14} />
            <span>Broadcast Live</span>
          </Button>
        </div>
      </div>

      {/* Active Broadcasts Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
            <Radio size={13} className="text-red-500 animate-pulse" />
            Active Broadcast Streams ({liveSessions.length})
          </h3>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        ) : liveSessions.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20">
            <Video size={24} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-400 font-semibold">
              No live broadcast rooms right now.
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              Click &quot;Broadcast Live&quot; to start sharing your screen with the community.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveSessions.map((session) => {
              const canDeleteThis = isAdmin || (user && String(user.id) === String(session.hostId));
              return (
                <Card
                  key={session.id}
                  className="p-4 border border-zinc-850 bg-zinc-950/40 flex flex-col justify-between hover:border-red-500/40 transition-all duration-300 rounded-xl shadow-lg relative group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={session.host.displayName || session.host.username}
                          src={session.host.avatarUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate leading-tight">
                            {session.host.displayName || session.host.username}
                          </span>
                          <span className="text-[9px] text-zinc-500 block truncate">
                            @{session.host.username}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                          {session.participantsCount} viewing
                        </span>

                        {canDeleteThis && (
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            disabled={deletingId === session.id}
                            className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                            title="Delete live session (Admin / Host)"
                          >
                            <Trash2 size={13} className={deletingId === session.id ? 'animate-spin' : ''} />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-white mb-1.5 leading-snug line-clamp-2">
                      {session.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3 mb-4">
                      {session.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-900">
                    <Button
                      onClick={() => handleJoinSession(session.id)}
                      size="sm"
                      className="flex-1 bg-blue-600 hover:bg-blue-500 font-bold text-xs py-1.5 flex items-center justify-center gap-1.5"
                    >
                      <Video size={13} />
                      <span>Join Room</span>
                    </Button>

                    {isAdmin && (
                      <Button
                        onClick={() => handleAdminCutOff(session.id)}
                        size="sm"
                        disabled={cuttingOff === session.id}
                        className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs px-3 flex items-center gap-1"
                        title="Admin: Terminate live session"
                      >
                        {cuttingOff === session.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        <span>Cut Off</span>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Scheduled/Upcoming Presentations */}
      {scheduledSessions.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-zinc-900">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={13} className="text-blue-400" />
            Upcoming Presentations ({scheduledSessions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scheduledSessions.map((session) => {
              const canDeleteThis = isAdmin || (user && String(user.id) === String(session.hostId));
              return (
                <Card
                  key={session.id}
                  className="p-4 border border-zinc-900 bg-zinc-950/20 flex flex-col justify-between rounded-xl relative group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Scheduled Presentation
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-zinc-500">
                          by @{session.host.username}
                        </span>
                        {canDeleteThis && (
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                            title="Delete scheduled presentation"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-white mb-1">
                      {session.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                      {session.description}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleJoinSession(session.id)}
                    size="sm"
                    variant="outline"
                    className="mt-3 text-xs font-semibold w-full border-zinc-850 hover:bg-zinc-900"
                  >
                    Enter Waiting Room
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Session History */}
      <div className="space-y-4 pt-4 border-t border-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={13} className="text-zinc-500" />
            Past Session History ({endedSessions.length})
          </h3>
          {isAdmin && endedSessions.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 hover:underline transition-colors"
            >
              <Trash2 size={12} /> Clear All History
            </button>
          )}
        </div>

        {endedSessions.length === 0 ? (
          <div className="py-6 text-center border border-dashed border-zinc-900/60 rounded-xl bg-zinc-950/20">
            <p className="text-[11px] text-zinc-500">
              No past live session history.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {endedSessions.map((session) => {
              const canDeleteThis = isAdmin || (user && String(user.id) === String(session.hostId));
              return (
                <Card
                  key={session.id}
                  className="p-4 border border-zinc-900 bg-zinc-950/20 flex flex-col justify-between rounded-xl"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">
                        Ended Broadcast
                      </span>
                      {canDeleteThis && (
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 p-1 rounded transition-colors"
                          title="Delete from history"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white mb-1">
                      {session.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                      {session.description}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Broadcast Setup Modal */}
      {createOpen && (
        <Modal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Setup Live Broadcast Room"
        >
          <form onSubmit={handleCreateSession} className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                Webinar / Broadcast Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="E.g., London Open Order Flow & High Probability Setups"
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                required
                disabled={creating}
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                Description & Strategy Outline
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Disclose assets analyzed, strategies tested, indicators utilized..."
                className="w-full h-20 bg-zinc-950 border border-zinc-850 rounded-lg p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
                disabled={creating}
              />
            </div>

            {/* Room Access Mode Toggle */}
            <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-2">
              <label className="text-[10px] font-bold text-zinc-300 block uppercase tracking-wider">
                Audience Access Control
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRequiresApproval(false)}
                  className={`flex-1 p-2 rounded-lg border text-left transition-all ${
                    !requiresApproval
                      ? 'bg-blue-600/15 border-blue-500/40 text-white'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold mb-0.5">
                    <Globe size={12} className="text-blue-400" />
                    <span>Open Access</span>
                  </div>
                  <p className="text-[9px] text-zinc-400">
                    Traders can join immediately without waiting for host approval.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRequiresApproval(true)}
                  className={`flex-1 p-2 rounded-lg border text-left transition-all ${
                    requiresApproval
                      ? 'bg-purple-600/15 border-purple-500/40 text-white'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold mb-0.5">
                    <Lock size={12} className="text-purple-400" />
                    <span>Host Approval</span>
                  </div>
                  <p className="text-[9px] text-zinc-400">
                    Host manually approves incoming viewer join requests.
                  </p>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 font-bold text-xs"
                type="submit"
                disabled={creating}
              >
                {creating ? (
                  <span className="flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Establishing...
                  </span>
                ) : (
                  'Start Broadcast Now'
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
