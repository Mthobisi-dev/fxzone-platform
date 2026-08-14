'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Video, Users, Plus, RefreshCw, Loader2, Calendar, Radio, Trash2 } from 'lucide-react';
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
}

export default function SessionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cuttingOff, setCuttingOff] = useState<string | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const isAdmin = !!user && (
    (user as any).role === 'admin' ||
    (user as any).username === 'admin' ||
    (user as any).email === 'admin@fxzone.io'
  );

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/sessions');
      if (Array.isArray(response)) {
        const mapped = response.map((s: any) => ({
          id: s.id,
          hostId: s.host_id || s.hostId,
          host: {
            username: s.host?.username || '',
            displayName: s.host?.display_name || s.host?.displayName || '',
            avatarUrl: s.host?.avatar_url || s.host?.avatarUrl,
          },
          title: s.title,
          description: s.description || '',
          status: s.status,
          participantsCount: s.participants_count || s.participantsCount || 0,
          startedAt: s.started_at || s.startedAt,
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
    if (!confirm('Clear ALL ended session records and their participant history? This cannot be undone.')) return;
    try {
      await api.delete('/api/sessions/history');
      setSessions((prev) => prev.filter((s) => s.status !== 'ended'));
    } catch (err) {
      console.error('Clear history error:', err);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Permanently delete this session record?')) return;
    try {
      await api.delete(`/api/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Delete session error:', err);
    }
  };

  // Admin-only: terminate a live/scheduled session without being the host
  const handleAdminCutOff = async (id: string) => {
    if (!confirm('Cut off this live session? All participants will be disconnected.')) return;
    setCuttingOff(id);
    try {
      await api.post(`/api/sessions/${id}/end`, {});
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'ended' } : s))
      );
    } catch (err) {
      console.error('Admin cutoff error:', err);
      alert('Failed to cut off session. Check console.');
    } finally {
      setCuttingOff(null);
    }
  };

  const liveSessions = sessions.filter((s) => s.status === 'live');
  const scheduledSessions = sessions.filter((s) => s.status === 'scheduled');
  const endedSessions = sessions.filter((s) => s.status === 'ended');

  const isEducator = !!user;

  return (
    <div className="p-4 md:p-6 space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between select-none">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Live Trading Rooms</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">Stream, share screens, and dissect order depth live with verified educators.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          
          {isEducator && (
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              className="h-8 text-xs font-semibold px-4 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500"
            >
              <Plus size={14} />
              <span>Broadcast Live</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active Broadcasts grid */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <Radio size={12} className="text-red-500 animate-pulse" /> Active Broadcast Streams ({liveSessions.length})
        </h3>
        
        {loading && sessions.length === 0 ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        ) : liveSessions.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-zinc-900 rounded-xl bg-zinc-950/10">
            <p className="text-xs text-zinc-500 italic">No broadcast rooms are currently live. Check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveSessions.map((session) => (
              <Card
                key={session.id}
                className="p-4 border border-zinc-900 bg-zinc-950/40 flex flex-col justify-between hover:border-red-500/30 transition-all duration-300"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={session.host.displayName || session.host.username} src={session.host.avatarUrl} size="sm" />
                      <div>
                        <span className="text-[10px] font-bold text-white block leading-tight">
                          {session.host.displayName || session.host.username}
                        </span>
                        <span className="text-[8px] text-zinc-500">@{session.host.username}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                        <Users size={10} /> {session.participantsCount} viewing
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="p-1 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                          title="Delete session record (Admin)"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-white mb-1.5 leading-snug">{session.title}</h4>
                  <p className="text-[11px] text-zinc-450 leading-relaxed line-clamp-3 mb-4">
                    {session.description}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleJoinSession(session.id)}
                    size="sm"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 font-semibold text-xs py-1.5"
                  >
                    Join Room
                  </Button>
                  {isAdmin && (
                    <Button
                      onClick={() => handleAdminCutOff(session.id)}
                      size="sm"
                      disabled={cuttingOff === session.id}
                      className="bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs px-3 flex items-center gap-1"
                      title="Admin: Terminate live session"
                    >
                      {cuttingOff === session.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      Cut Off
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Scheduled/Upcoming */}
      {scheduledSessions.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-zinc-900">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={12} className="text-blue-400" /> Upcoming Presentations ({scheduledSessions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduledSessions.map((session) => (
              <Card
                key={session.id}
                className="p-4 border border-zinc-900 bg-zinc-950/20 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[8px] text-zinc-550 font-bold uppercase tracking-wider">
                      Scheduled Presentation
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">{session.title}</h4>
                  <p className="text-[11px] text-zinc-450 leading-relaxed line-clamp-2">{session.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Session History */}
      <div className="space-y-4 pt-4 border-t border-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <Video size={12} className="text-zinc-500" /> Past Session History ({endedSessions.length})
          </h3>
          {isAdmin && (
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
            <p className="text-[11px] text-zinc-500">No past live session history.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {endedSessions.map((session) => (
              <Card
                key={session.id}
                className="p-4 border border-zinc-900 bg-zinc-950/20 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">
                      Ended Broadcast
                    </span>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1 rounded transition-colors"
                      title="Delete from history"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">{session.title}</h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">{session.description}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      {createOpen && (
        <Modal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Setup Live Broadcast Room"
        >
          <form onSubmit={handleCreateSession} className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Webinar Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="E.g., London Open Order flows analysis"
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                required
                disabled={creating}
              />
            </div>
            
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Webinar Description</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Disclose assets covered, strategies analyzed, or indicators utilized..."
                className="w-full h-20 bg-zinc-950 border border-zinc-850 rounded-lg p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
                disabled={creating}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500" type="submit" disabled={creating}>
                {creating ? 'Establishing Room...' : 'Start Broadcast'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
