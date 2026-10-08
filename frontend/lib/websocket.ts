/**
 * FxZone Supabase Realtime WebSocket Client Wrapper
 * Uses Supabase Realtime Broadcast Channels for application events.
 */

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type WSCallback = (data: any) => void;

const PRIVATE_TOPIC_PREFIXES = ['chat_', 'session_', 'notifications_'] as const;
const PUBLIC_READ_ONLY_TOPICS = new Set(['market', 'news']);

export type WSState = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'CLOSING' | 'CLOSED';

export class FxZoneWebSocket {
  private channel: RealtimeChannel | null = null;
  private channelName: string;
  private listeners: Map<string, Set<WSCallback>> = new Map();
  private state: WSState = 'IDLE';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pendingOutbound: any[] = [];
  private connectionGeneration = 0;
  private readonly isPrivateTopic: boolean;
  private readonly isPublicReadOnlyTopic: boolean;

  constructor(path: string) {
    // Sanitize path into valid Supabase channel name e.g. /ws/chat/123 -> chat_123
    const sanitized = path
      .replace(/^\/ws\//, '')
      .replace(/^\//, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    this.channelName = sanitized || 'fxzone_global';
    this.isPrivateTopic = PRIVATE_TOPIC_PREFIXES.some((prefix) => this.channelName.startsWith(prefix));
    this.isPublicReadOnlyTopic = PUBLIC_READ_ONLY_TOPICS.has(this.channelName);
  }

  public getState(): WSState {
    return this.state;
  }

  /**
   * Connect to Supabase Realtime Channel.
   */
  public async connect(): Promise<void> {
    if (this.state === 'CONNECTED' || this.state === 'CONNECTING' || this.state === 'RECONNECTING') return;

    this.state = this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING';
    const generation = ++this.connectionGeneration;

    // Private Realtime topics are authorized from the JWT available to the
    // browser client when the channel joins. Waiting for the Auth session here
    // prevents a session room from subscribing with the public key while Auth
    // is still hydrating after a page navigation or token refresh.
    if (this.isPrivateTopic) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.access_token) {
          throw error || new Error('An authenticated Supabase session is required');
        }

        // `setAuth()` reads from Supabase's access-token callback. Calling it
        // immediately before subscribing makes the current token available to
        // Realtime RLS rather than relying on an earlier initialization race.
        await supabase.realtime.setAuth();
      } catch (error) {
        if (generation !== this.connectionGeneration) return;
        this.state = 'CLOSED';
        this.emit('error', error);
        this.emit('close', { reason: 'Realtime authentication is unavailable' });
        return;
      }
    }

    if (generation !== this.connectionGeneration) return;

    this.channel = supabase.channel(this.channelName, {
      config: {
        // Private topic access is enforced by RLS policies on
        // realtime.messages. Market and news remain read-only public topics.
        private: this.isPrivateTopic,
        // Acknowledgements make `.send()` resolve only after Realtime accepts
        // the message, so failed SDP/ICE messages can be queued for reconnect.
        broadcast: { self: true, ack: true },
      },
    });

    this.channel
      .on('broadcast', { event: '*' }, (payload) => {
        if (generation !== this.connectionGeneration) return;
        const eventType = payload.event;
        const data = payload.payload;
        if (eventType) {
          this.emit(eventType, data);
        }
        if (eventType !== 'message') this.emit('message', data);
      })
      .subscribe((status, error) => {
        if (generation !== this.connectionGeneration) return;
        if (status === 'SUBSCRIBED') {
          this.state = 'CONNECTED';
          this.reconnectAttempts = 0;
          this.flushPendingOutbound();
          this.emit('open', null);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.emit('error', error || { status, channel: this.channelName });
          if (this.state !== 'CLOSING' && this.state !== 'CLOSED') {
            this.handleReconnect();
          }
        }
      });
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.state = 'CLOSED';
      this.emit('close', { reason: 'Max reconnect attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    this.state = 'RECONNECTING';
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts) + Math.random() * 500, 10000);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const pending = this.pendingOutbound.splice(0);
      this.close();
      this.pendingOutbound = pending;
      void this.connect();
    }, delay);
  }

  /**
   * Unsubscribe and close Supabase Realtime Channel.
   */
  public close() {
    this.connectionGeneration++;
    this.state = 'CLOSING';
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.state = 'CLOSED';
    this.pendingOutbound = [];
    this.emit('close', null);
  }

  /**
   * Broadcast message over Supabase Realtime.
   */
  public send(payload: any) {
    if (this.state === 'CLOSED' || this.state === 'CLOSING') return false;
    if (this.isPublicReadOnlyTopic) {
      console.warn(`Broadcasting is disabled for public ${this.channelName} data.`);
      return false;
    }

    // Supabase accepts channel sends only after a successful subscription. Queue
    // early WebRTC offers/candidates instead of silently dropping them while a
    // private session topic is still authorizing.
    if (!this.channel || this.state !== 'CONNECTED') {
      this.enqueueOutbound(payload);
      return true;
    }

    this.sendNow(payload);
    return true;
  }

  private enqueueOutbound(payload: any) {
    const maximumQueuedMessages = 100;
    if (this.pendingOutbound.length >= maximumQueuedMessages) {
      this.pendingOutbound.shift();
    }
    this.pendingOutbound.push(payload);
  }

  private flushPendingOutbound() {
    const queued = this.pendingOutbound.splice(0);
    queued.forEach((payload) => this.sendNow(payload));
  }

  private sendNow(payload: any) {
    if (!this.channel || this.state !== 'CONNECTED') {
      this.enqueueOutbound(payload);
      return;
    }

    const eventType = payload.type || payload.event || 'message';
    void this.channel.send({
      type: 'broadcast',
      event: eventType,
      payload: payload,
    }).then((status) => {
      // A message accepted before reconnect may still time out. Preserve it for
      // the next subscription rather than dropping critical signaling data.
      if (status !== 'ok' && this.state !== 'CLOSING' && this.state !== 'CLOSED') {
        this.enqueueOutbound(payload);
      }
    }).catch(() => {
      if (this.state !== 'CLOSING' && this.state !== 'CLOSED') {
        this.enqueueOutbound(payload);
      }
    });
  }

  /**
   * Subscribe to specific data events (e.g. 'prices', 'message', 'notification', 'offer', 'answer', 'candidate').
   */
  public on(event: string, callback: WSCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from specific data events.
   */
  public off(event: string, callback: WSCallback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.warn('[Supabase Realtime Warning]', e);
        }
      });
    }
  }
}
